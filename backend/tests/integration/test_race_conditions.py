import asyncio
import uuid
from datetime import UTC, datetime, time, timedelta

import pytest
import uuid6
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import (
    BookingModel,
    BusinessHoursModel,
    ClubModel,
    CourtModel,
    PricingRuleModel,
)
from app.main import app


@pytest.fixture
async def api_client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest.fixture
async def seeded_club(db_session: AsyncSession) -> tuple[ClubModel, CourtModel]:
    club_id = uuid6.uuid7()
    slug = f"club-race-{uuid.uuid4().hex}"
    club = ClubModel(
        id=club_id,
        slug=slug,
        name="Club Race Conditions",
        timezone="America/Bogota",
        is_published=True,
        subscription_status="active",
        address="Calle 100, Bogotá",
        settings={"deposit_percentage": 0, "payment_mode": "on_site"},
    )
    court = CourtModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        name="Cancha Central",
        sport="padel",
        surface="synthetic_grass",
        player_format="doubles",
        is_active=True,
        position=1,
    )
    # Business hours for every day
    hours = [
        BusinessHoursModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            weekday=i,
            opens_at=time(6, 0),
            closes_at=time(23, 0),
            closes_next_day=False,
        )
        for i in range(7)
    ]
    # Pricing rule
    rule = PricingRuleModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        court_id=court.id,
        weekday_mask=127,
        start_time=time(6, 0),
        end_time=time(23, 0),
        price_cents=6000000,
        currency="COP",
    )
    db_session.add(club)
    db_session.add(court)
    db_session.add_all(hours)
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(club)
    await db_session.refresh(court)
    return club, court


@pytest.mark.asyncio
async def test_public_catalogue_and_availability(
    api_client: AsyncClient,
    seeded_club: tuple[ClubModel, CourtModel],
) -> None:
    club, _ = seeded_club

    # 1. List published clubs
    resp_list = await api_client.get("/api/v1/clubs")
    assert resp_list.status_code == 200
    clubs = resp_list.json()
    assert any(c["slug"] == club.slug for c in clubs)

    # 2. Get club detail
    resp_detail = await api_client.get(f"/api/v1/clubs/{club.slug}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert detail["name"] == club.name
    assert len(detail["courts"]) >= 1

    # 3. Get availability for tomorrow
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).date()
    resp_avail = await api_client.get(
        f"/api/v1/clubs/{club.slug}/availability?date={tomorrow.isoformat()}&duration=60"
    )
    assert resp_avail.status_code == 200
    slots = resp_avail.json()
    assert len(slots) > 0
    assert slots[0]["price_cents"] == 6000000


@pytest.mark.asyncio
async def test_hold_and_idempotent_confirmation_flow(
    api_client: AsyncClient,
    seeded_club: tuple[ClubModel, CourtModel],
) -> None:
    club, court = seeded_club
    slot_time = (datetime.now(UTC) + timedelta(days=2)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )

    # 1. Create hold
    hold_resp = await api_client.post(
        "/api/v1/bookings/holds",
        json={
            "club_slug": club.slug,
            "court_id": str(court.id),
            "start_time": slot_time.isoformat(),
            "duration_minutes": 60,
        },
    )
    assert hold_resp.status_code == 201
    hold_data = hold_resp.json()
    hold_id = hold_data["hold_id"]
    code = hold_data["code"]

    # 2. Confirm booking with Idempotency-Key
    idemp_key = f"key-{uuid.uuid4().hex}"
    confirm_resp = await api_client.post(
        "/api/v1/bookings",
        headers={"Idempotency-Key": idemp_key},
        json={
            "hold_id": hold_id,
            "customer_name": "Carlos Moreno",
            "customer_phone": "+573001234567",
            "customer_email": "carlos@example.com",
        },
    )
    assert confirm_resp.status_code == 200
    booking_data = confirm_resp.json()
    assert booking_data["status"] == "confirmed"
    assert booking_data["code"] == code

    # 3. Re-send confirmation with SAME Idempotency-Key (idempotent duplicate request)
    dup_confirm_resp = await api_client.post(
        "/api/v1/bookings",
        headers={"Idempotency-Key": idemp_key},
        json={
            "hold_id": hold_id,
            "customer_name": "Carlos Moreno",
            "customer_phone": "+573001234567",
            "customer_email": "carlos@example.com",
        },
    )
    assert dup_confirm_resp.status_code == 200
    assert dup_confirm_resp.json()["id"] == booking_data["id"]

    # 4. Lookup booking by code
    lookup_resp = await api_client.get(f"/api/v1/bookings/by-code/{code}?phone=4567")
    assert lookup_resp.status_code == 200
    assert lookup_resp.json()["customer_name"] == "Carlos Moreno"

    # 5. Cancel booking
    cancel_resp = await api_client.post(
        f"/api/v1/bookings/by-code/{code}/cancel",
        json={"phone": "+573001234567", "reason": "Cambio de planes"},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_concurrency_race_condition_20_simultaneous_requests(
    seeded_club: tuple[ClubModel, CourtModel],
    db_session: AsyncSession,
) -> None:
    """CRITICAL ACCEPTANCE CRITERION FOR PHASE 4:
    20 simultaneous concurrent requests competing for the exact same slot.
    EXACTLY ONE request succeeds (201 Created), and the remaining 19 fail
    with 409 Conflict ('SLOT_UNAVAILABLE').
    """
    club, court = seeded_club
    target_slot = (datetime.now(UTC) + timedelta(days=5)).replace(
        hour=18, minute=0, second=0, microsecond=0
    )

    async def attempt_hold() -> int:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            resp = await client.post(
                "/api/v1/bookings/holds",
                json={
                    "club_slug": club.slug,
                    "court_id": str(court.id),
                    "start_time": target_slot.isoformat(),
                    "duration_minutes": 60,
                },
            )
            return resp.status_code

    # Fire 20 parallel requests simultaneously using asyncio.gather
    tasks = [attempt_hold() for _ in range(20)]
    results = await asyncio.gather(*tasks)

    success_count = results.count(201)
    conflict_count = results.count(409)

    # EXACTLY 1 confirms, 19 rejected
    assert success_count == 1, f"Expected 1 success, got {success_count} (results: {results})"
    assert conflict_count == 19, f"Expected 19 conflicts, got {conflict_count} (results: {results})"

    # Verify database state has exactly 1 booking for this slot
    query = select(BookingModel).where(
        BookingModel.club_id == club.id,
        BookingModel.court_id == court.id,
        BookingModel.status == "held",
    )
    records = (await db_session.scalars(query)).all()
    assert len(records) == 1
