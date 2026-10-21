import uuid
from datetime import UTC, datetime, time, timedelta

import pytest
import uuid6
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
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
async def seeded_multicourt_club(
    db_session: AsyncSession,
) -> tuple[ClubModel, list[CourtModel]]:
    club_id = uuid6.uuid7()
    slug = f"club-pool-{uuid.uuid4().hex[:8]}"
    club = ClubModel(
        id=club_id,
        slug=slug,
        name="Club Multi Canchas Futbox",
        timezone="America/Bogota",
        is_published=True,
        subscription_status="active",
        address="Cra 10 # 20-30",
        settings={
            "court_selection_mode": "by_category",
            "allowed_durations": [60],
            "default_duration": 60,
        },
    )

    # 2 identical synthetic 5x5 courts
    c1 = CourtModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        name="Cancha Sintética 1 (5x5)",
        sport="soccer",
        surface="synthetic_grass",
        player_format="5x5",
        is_active=True,
        position=1,
    )
    c2 = CourtModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        name="Cancha Sintética 2 (5x5)",
        sport="soccer",
        surface="synthetic_grass",
        player_format="5x5",
        is_active=True,
        position=2,
    )
    # 1 larger 11x11 court
    c3 = CourtModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        name="Cancha Principal (11x11)",
        sport="soccer",
        surface="turf",
        player_format="11x11",
        is_active=True,
        position=3,
    )

    # Business hours
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

    # Pricing rules
    r1 = PricingRuleModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        court_id=None,
        weekday_mask=127,
        start_time=time(6, 0),
        end_time=time(23, 0),
        price_cents=6000000,
        currency="COP",
    )

    db_session.add(club)
    db_session.add_all([c1, c2, c3])
    db_session.add_all(hours)
    db_session.add(r1)
    await db_session.commit()

    try:
        yield club, [c1, c2, c3]
    finally:
        await db_session.execute(delete(BookingModel).where(BookingModel.club_id == club.id))
        await db_session.execute(delete(PricingRuleModel).where(PricingRuleModel.club_id == club.id))
        await db_session.execute(delete(BusinessHoursModel).where(BusinessHoursModel.club_id == club.id))
        await db_session.execute(delete(CourtModel).where(CourtModel.club_id == club.id))
        await db_session.execute(delete(ClubModel).where(ClubModel.id == club.id))
        await db_session.commit()


@pytest.mark.asyncio
async def test_club_detail_exposes_court_groups_and_selection_mode(
    api_client: AsyncClient,
    seeded_multicourt_club: tuple[ClubModel, list[CourtModel]],
) -> None:
    club, courts = seeded_multicourt_club
    resp = await api_client.get(f"/api/v1/clubs/{club.slug}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["court_selection_mode"] == "by_category"
    assert len(data["court_groups"]) == 2

    # Group 1: 5x5 (2 courts)
    g_5x5 = next(g for g in data["court_groups"] if g["player_format"] == "5x5")
    assert g_5x5["court_count"] == 2
    assert len(g_5x5["court_ids"]) == 2
    assert g_5x5["price_per_hour_cents"] == 6000000

    # Group 2: 11x11 (1 court)
    g_11x11 = next(g for g in data["court_groups"] if g["player_format"] == "11x11")
    assert g_11x11["court_count"] == 1
    assert len(g_11x11["court_ids"]) == 1


@pytest.mark.asyncio
async def test_auto_assignment_allocates_slots_and_prevents_overbooking(
    api_client: AsyncClient,
    seeded_multicourt_club: tuple[ClubModel, list[CourtModel]],
) -> None:
    club, courts = seeded_multicourt_club
    resp = await api_client.get(f"/api/v1/clubs/{club.slug}")
    groups = resp.json()["court_groups"]
    g_5x5 = next(g for g in groups if g["player_format"] == "5x5")

    # Target slot: tomorrow at 19:00 UTC
    target_start = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=19, minute=0, second=0, microsecond=0
    )

    # 1. First guest holds a slot in 5x5 without specifying court_id
    resp_hold1 = await api_client.post(
        "/api/v1/bookings/holds",
        json={
            "club_slug": club.slug,
            "group_id": g_5x5["id"],
            "start_time": target_start.isoformat(),
            "duration_minutes": 60,
        },
    )
    assert resp_hold1.status_code == 201
    h1 = resp_hold1.json()
    assert h1["court_id"] in g_5x5["court_ids"]

    # 2. Second guest holds a slot in 5x5 at the EXACT same hour
    # Since there are 2 courts in 5x5, this MUST succeed and assign the other court
    resp_hold2 = await api_client.post(
        "/api/v1/bookings/holds",
        json={
            "club_slug": club.slug,
            "group_id": g_5x5["id"],
            "start_time": target_start.isoformat(),
            "duration_minutes": 60,
        },
    )
    assert resp_hold2.status_code == 201
    h2 = resp_hold2.json()
    assert h2["court_id"] in g_5x5["court_ids"]
    assert h1["court_id"] != h2["court_id"], "Each guest must be assigned a distinct court"

    # 3. Third guest tries to hold in 5x5 at the same hour
    # All 2 courts in this modality are busy -> Must return 409 Conflict
    resp_hold3 = await api_client.post(
        "/api/v1/bookings/holds",
        json={
            "club_slug": club.slug,
            "group_id": g_5x5["id"],
            "start_time": target_start.isoformat(),
            "duration_minutes": 60,
        },
    )
    assert resp_hold3.status_code == 409
    assert "ocupadas" in resp_hold3.json()["detail"].lower()
