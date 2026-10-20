import uuid
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

import asyncpg
import httpx
import pytest
import uuid6
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.value_objects.booking_code import BookingCode
from app.infrastructure.db.models import (
    BookingModel,
    BusinessHoursModel,
    ClubMemberModel,
    ClubModel,
    CourtModel,
    UserModel,
)
from app.infrastructure.security.jwt import create_access_token
from app.infrastructure.security.password import hash_password


@pytest.mark.asyncio
async def test_superadmin_access_control_and_club_lifecycle(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Superadmin endpoints require is_superadmin=True.

    Regular club admins receive 403 Forbidden.
    Superadmin can create clubs, toggle status, and inspect KPIs.
    """
    # 1. Create a regular user
    regular_email = f"regular_{uuid.uuid4().hex}@test.com"
    reg_user = UserModel(
        id=uuid6.uuid7(),
        email=regular_email,
        password_hash=hash_password("RegularPass123!"),
        full_name="Regular User",
        is_superadmin=False,
    )
    # 2. Create a superadmin user
    super_email = f"super_{uuid.uuid4().hex}@test.com"
    super_user = UserModel(
        id=uuid6.uuid7(),
        email=super_email,
        password_hash=hash_password("SuperSecret123!"),
        full_name="Global Superadmin",
        is_superadmin=True,
    )
    db_session.add_all([reg_user, super_user])
    await db_session.commit()

    regular_token = create_access_token(
        user_id=reg_user.id,
        email=reg_user.email,
        full_name=reg_user.full_name,
        is_superadmin=False,
        memberships=[],
    )
    super_token = create_access_token(
        user_id=super_user.id,
        email=super_user.email,
        full_name=super_user.full_name,
        is_superadmin=True,
        memberships=[],
    )

    reg_headers = {"Authorization": f"Bearer {regular_token}"}
    super_headers = {"Authorization": f"Bearer {super_token}"}

    # 3. Regular user receives 403 Forbidden
    resp_stats_reg = await api_client.get("/api/v1/superadmin/stats", headers=reg_headers)
    assert resp_stats_reg.status_code == 403

    # 4. Superadmin receives 200 OK on stats
    resp_stats_super = await api_client.get("/api/v1/superadmin/stats", headers=super_headers)
    assert resp_stats_super.status_code == 200
    stats = resp_stats_super.json()
    assert "total_clubs" in stats
    assert "total_courts" in stats

    # 5. Superadmin creates a new club
    new_slug = f"club-super-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "name": "Super Club Arena",
        "slug": new_slug,
        "timezone": "America/Bogota",
        "currency": "COP",
        "address": "Calle 100 # 15-20",
        "subscription_status": "trial",
        "is_published": False,
        "admin_user_email": regular_email,
    }
    resp_create = await api_client.post(
        "/api/v1/superadmin/clubs",
        json=create_payload,
        headers=super_headers,
    )
    assert resp_create.status_code == 201
    created_club = resp_create.json()
    club_id = created_club["id"]
    assert created_club["slug"] == new_slug
    assert created_club["subscription_status"] == "trial"
    assert created_club["members_count"] == 1

    # 6. Superadmin updates club status to active & published
    resp_patch = await api_client.patch(
        f"/api/v1/superadmin/clubs/{club_id}",
        json={"subscription_status": "active", "is_published": True},
        headers=super_headers,
    )
    assert resp_patch.status_code == 200
    assert resp_patch.json()["subscription_status"] == "active"
    assert resp_patch.json()["is_published"] is True

    # 7. List clubs with filter
    resp_list = await api_client.get(
        "/api/v1/superadmin/clubs",
        params={"search": new_slug, "subscription_status": "active"},
        headers=super_headers,
    )
    assert resp_list.status_code == 200
    assert len(resp_list.json()) == 1
    assert resp_list.json()[0]["id"] == club_id

    # 8. Superadmin deletes club (soft delete)
    resp_delete = await api_client.delete(
        f"/api/v1/superadmin/clubs/{club_id}",
        headers=super_headers,
    )
    assert resp_delete.status_code == 204

    # 9. Verify club is excluded from active list and returns 404 on direct fetch
    resp_get_deleted = await api_client.get(
        f"/api/v1/superadmin/clubs/{club_id}",
        headers=super_headers,
    )
    assert resp_get_deleted.status_code == 404

    resp_list_deleted = await api_client.get(
        "/api/v1/superadmin/clubs",
        params={"search": new_slug},
        headers=super_headers,
    )
    assert resp_list_deleted.status_code == 200
    assert len(resp_list_deleted.json()) == 0


@pytest.mark.asyncio
async def test_club_occupancy_and_revenue_reports(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Admin can query occupancy & revenue reports with accurate aggregations."""
    local_tz = ZoneInfo("America/Bogota")
    # 1. Create club with 2 courts and business hours (08:00 - 20:00 every day)
    club = ClubModel(
        id=uuid6.uuid7(),
        slug=f"reports-club-{uuid.uuid4().hex[:8]}",
        name="Reports Padel Club",
        timezone="America/Bogota",
        settings={"currency": "COP"},
        is_published=True,
        subscription_status="active",
    )
    c1 = CourtModel(
        id=uuid6.uuid7(),
        club_id=club.id,
        name="Pista Central",
        sport="padel",
        surface="turf",
        player_format="doubles",
        is_covered=True,
        has_lighting=True,
    )
    c2 = CourtModel(
        id=uuid6.uuid7(),
        club_id=club.id,
        name="Pista 2",
        sport="padel",
        surface="turf",
        player_format="doubles",
        is_covered=False,
        has_lighting=True,
    )
    db_session.add_all([club, c1, c2])

    for dow in range(7):
        bh = BusinessHoursModel(
            id=uuid6.uuid7(),
            club_id=club.id,
            weekday=dow,
            opens_at=time(8, 0),
            closes_at=time(20, 0),  # 12 hours = 720 minutes per day per court
            closes_next_day=False,
        )
        db_session.add(bh)

    # 2. Create Admin user
    admin_user = UserModel(
        id=uuid6.uuid7(),
        email=f"admin_rep_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("AdminPass123!"),
        full_name="Report Admin",
        is_superadmin=False,
    )
    db_session.add(admin_user)

    membership = ClubMemberModel(
        id=uuid6.uuid7(),
        user_id=admin_user.id,
        club_id=club.id,
        role="admin",
        is_active=True,
    )
    db_session.add(membership)

    # 3. Create 2 confirmed bookings on target date: 2026-11-10 (Tuesday)
    # Booking 1: Court 1, 09:00 - 10:30 (90 min in morning, price $90.000 COP = 9,000,000 cents)
    b1_start_local = datetime(2026, 11, 10, 9, 0, tzinfo=local_tz)
    b1_end_local = datetime(2026, 11, 10, 10, 30, tzinfo=local_tz)
    b1 = BookingModel(
        id=uuid6.uuid7(),
        club_id=club.id,
        court_id=c1.id,
        code=BookingCode.generate().value,
        status="confirmed",
        payment_status="paid",
        period=asyncpg.Range(
            b1_start_local.astimezone(UTC),
            b1_end_local.astimezone(UTC),
            lower_inc=True,
            upper_inc=False,
        ),
        price_cents=9000000,
        currency="COP",
        customer_name="Jugador Uno",
        customer_email="uno@test.com",
        customer_phone="+573001112233",
    )
    # Booking 2: Court 2, 18:30 - 20:00 (90 min in night, price $120.000 COP = 12,000,000 cents)
    b2_start_local = datetime(2026, 11, 10, 18, 30, tzinfo=local_tz)
    b2_end_local = datetime(2026, 11, 10, 20, 0, tzinfo=local_tz)
    b2 = BookingModel(
        id=uuid6.uuid7(),
        club_id=club.id,
        court_id=c2.id,
        code=BookingCode.generate().value,
        status="confirmed",
        payment_status="paid",
        period=asyncpg.Range(
            b2_start_local.astimezone(UTC),
            b2_end_local.astimezone(UTC),
            lower_inc=True,
            upper_inc=False,
        ),
        price_cents=12000000,
        currency="COP",
        customer_name="Jugador Dos",
        customer_email="dos@test.com",
        customer_phone="+573004445566",
    )
    db_session.add_all([b1, b2])
    await db_session.commit()

    token = create_access_token(
        user_id=admin_user.id,
        email=admin_user.email,
        full_name=admin_user.full_name,
        is_superadmin=False,
        memberships=[{"club_id": str(club.id), "role": "admin"}],
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Query Occupancy Report for target date
    resp_occ = await api_client.get(
        f"/api/v1/clubs/{club.id}/reports/occupancy",
        params={"start_date": "2026-11-10", "end_date": "2026-11-10"},
        headers=headers,
    )
    assert resp_occ.status_code == 200
    occ_data = resp_occ.json()

    # 2 courts * 720 min open (08:00 to 20:00) = 1440 min total available
    assert occ_data["total_available_minutes"] == 1440
    # 90 min + 90 min = 180 min booked
    assert occ_data["total_booked_minutes"] == 180
    assert occ_data["overall_occupancy_percentage"] == 12.5  # 180 / 1440 * 100

    # 5. Query Revenue Report for target date
    resp_rev = await api_client.get(
        f"/api/v1/clubs/{club.id}/reports/revenue",
        params={"start_date": "2026-11-10", "end_date": "2026-11-10"},
        headers=headers,
    )
    assert resp_rev.status_code == 200
    rev_data = resp_rev.json()
    assert rev_data["total_bookings"] == 2
    assert rev_data["total_revenue_cents"] == 21000000
    assert rev_data["average_ticket_cents"] == 10500000
    assert len(rev_data["daily"]) == 1
    assert rev_data["daily"][0]["booking_count"] == 2
    assert len(rev_data["by_court"]) == 2
