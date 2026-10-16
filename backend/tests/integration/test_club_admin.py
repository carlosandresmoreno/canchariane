import uuid
from datetime import UTC, datetime, timedelta

import pytest
import uuid6
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ClubMemberModel, ClubModel, UserModel
from app.infrastructure.security.jwt import create_access_token
from app.infrastructure.security.password import hash_password
from app.main import app


@pytest.fixture
async def api_client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest.fixture
async def admin_context(db_session: AsyncSession) -> tuple[ClubModel, UserModel, dict[str, str]]:
    club_id = uuid6.uuid7()
    club = ClubModel(
        id=club_id,
        slug=f"club-admin-{uuid.uuid4().hex}",
        name="Club Administración Pro",
        timezone="America/Bogota",
        is_published=True,
        subscription_status="active",
    )
    user_id = uuid6.uuid7()
    user = UserModel(
        id=user_id,
        email=f"admin_{uuid.uuid4().hex}@example.com",
        password_hash=hash_password("AdminPass123!"),
        full_name="Club Admin",
        is_superadmin=False,
    )
    membership = ClubMemberModel(
        id=uuid6.uuid7(),
        user_id=user_id,
        club_id=club_id,
        role="admin",
        is_active=True,
    )
    db_session.add_all([club, user, membership])
    await db_session.commit()

    token = create_access_token(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_superadmin=False,
        memberships=[{"club_id": str(club.id), "role": "admin"}],
    )
    headers = {"Authorization": f"Bearer {token}"}
    return club, user, headers


@pytest.mark.asyncio
async def test_courts_crud(
    api_client: AsyncClient,
    admin_context: tuple[ClubModel, UserModel, dict[str, str]],
) -> None:
    club, _, headers = admin_context

    # 1. Create Court
    resp_create = await api_client.post(
        f"/api/v1/clubs/{club.id}/courts",
        headers=headers,
        json={
            "name": "Cancha Pádel 1",
            "sport": "padel",
            "surface": "synthetic_grass",
            "player_format": "doubles",
            "is_covered": True,
            "has_lighting": True,
            "position": 1,
        },
    )
    assert resp_create.status_code == 201
    court = resp_create.json()
    court_id = court["id"]
    assert court["name"] == "Cancha Pádel 1"

    # 2. List Courts
    resp_list = await api_client.get(f"/api/v1/clubs/{club.id}/courts", headers=headers)
    assert resp_list.status_code == 200
    assert any(c["id"] == court_id for c in resp_list.json())

    # 3. Update Court
    resp_update = await api_client.patch(
        f"/api/v1/clubs/{club.id}/courts/{court_id}",
        headers=headers,
        json={"name": "Cancha Pádel Central", "is_covered": False},
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["name"] == "Cancha Pádel Central"
    assert resp_update.json()["is_covered"] is False

    # 4. Soft Delete Court
    resp_del = await api_client.delete(
        f"/api/v1/clubs/{club.id}/courts/{court_id}", headers=headers
    )
    assert resp_del.status_code == 204

    # List again: soft-deleted court is excluded
    resp_list_after = await api_client.get(f"/api/v1/clubs/{club.id}/courts", headers=headers)
    assert not any(c["id"] == court_id for c in resp_list_after.json())


@pytest.mark.asyncio
async def test_business_hours_atomic_replace(
    api_client: AsyncClient,
    admin_context: tuple[ClubModel, UserModel, dict[str, str]],
) -> None:
    club, _, headers = admin_context

    # Replace entire 7-day schedule
    new_hours = [
        {"weekday": i, "opens_at": "07:00", "closes_at": "23:00", "closes_next_day": False}
        for i in range(7)
    ]
    resp_put = await api_client.put(
        f"/api/v1/clubs/{club.id}/business-hours",
        headers=headers,
        json={"hours": new_hours},
    )
    assert resp_put.status_code == 200
    hours = resp_put.json()
    assert len(hours) == 7
    assert hours[0]["opens_at"] == "07:00"

    # GET returns updated hours
    resp_get = await api_client.get(f"/api/v1/clubs/{club.id}/business-hours", headers=headers)
    assert resp_get.status_code == 200
    assert len(resp_get.json()) == 7


@pytest.mark.asyncio
async def test_blocks_and_pricing_rules(
    api_client: AsyncClient,
    admin_context: tuple[ClubModel, UserModel, dict[str, str]],
) -> None:
    club, _, headers = admin_context

    # 1. Create Block
    start = datetime.now(UTC) + timedelta(days=3)
    end = start + timedelta(hours=4)
    resp_block = await api_client.post(
        f"/api/v1/clubs/{club.id}/blocks",
        headers=headers,
        json={
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "kind": "tournament",
            "reason": "Torneo de Primavera",
        },
    )
    assert resp_block.status_code == 201
    block_id = resp_block.json()["id"]

    # 2. List Blocks
    resp_blocks_list = await api_client.get(f"/api/v1/clubs/{club.id}/blocks", headers=headers)
    assert any(b["id"] == block_id for b in resp_blocks_list.json())

    # 3. Create Pricing Rule
    resp_rule = await api_client.post(
        f"/api/v1/clubs/{club.id}/pricing-rules",
        headers=headers,
        json={
            "weekday_mask": 127,
            "start_time": "18:00",
            "end_time": "22:00",
            "price_cents": 7500000,
            "currency": "COP",
        },
    )
    assert resp_rule.status_code == 201
    rule_id = resp_rule.json()["id"]

    # 4. Delete Pricing Rule & Block
    del_rule = await api_client.delete(
        f"/api/v1/clubs/{club.id}/pricing-rules/{rule_id}", headers=headers
    )
    assert del_rule.status_code == 204

    del_block = await api_client.delete(
        f"/api/v1/clubs/{club.id}/blocks/{block_id}", headers=headers
    )
    assert del_block.status_code == 204


@pytest.mark.asyncio
async def test_manual_booking_and_status_update(
    api_client: AsyncClient,
    admin_context: tuple[ClubModel, UserModel, dict[str, str]],
) -> None:
    club, _, headers = admin_context

    # Create court first
    c_resp = await api_client.post(
        f"/api/v1/clubs/{club.id}/courts",
        headers=headers,
        json={"name": "Cancha Manual", "sport": "padel", "surface": "synthetic_grass"},
    )
    court_id = c_resp.json()["id"]

    # 1. Create Manual Booking (phone / counter)
    slot_time = (datetime.now(UTC) + timedelta(days=2)).replace(
        hour=16, minute=0, second=0, microsecond=0
    )
    resp_manual = await api_client.post(
        f"/api/v1/clubs/{club.id}/bookings",
        headers=headers,
        json={
            "court_id": court_id,
            "period_start": slot_time.isoformat(),
            "duration_minutes": 60,
            "customer_name": "Cliente Mostrador",
            "customer_phone": "+573005556677",
            "customer_email": "mostrador@example.com",
            "price_cents": 5000000,
            "payment_status": "paid",
            "notes": "Pagó en efectivo en recepción",
        },
    )
    assert resp_manual.status_code == 201
    booking = resp_manual.json()
    booking_id = booking["id"]
    assert booking["status"] == "confirmed"
    assert booking["payment_status"] == "paid"

    # 2. Query admin bookings list
    list_resp = await api_client.get(f"/api/v1/clubs/{club.id}/bookings", headers=headers)
    assert list_resp.status_code == 200
    assert any(b["id"] == booking_id for b in list_resp.json())

    # 3. Mark as no_show
    patch_resp = await api_client.patch(
        f"/api/v1/clubs/{club.id}/bookings/{booking_id}",
        headers=headers,
        json={"status": "no_show", "cancellation_reason": "No se presentó a tiempo"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "no_show"


@pytest.mark.asyncio
async def test_layout_management_and_sse_events(
    api_client: AsyncClient,
    admin_context: tuple[ClubModel, UserModel, dict[str, str]],
) -> None:
    club, _, headers = admin_context

    # Create Court
    c_resp = await api_client.post(
        f"/api/v1/clubs/{club.id}/courts",
        headers=headers,
        json={"name": "Cancha Layout", "sport": "padel", "surface": "synthetic_grass"},
    )
    court_id = c_resp.json()["id"]

    # 1. PUT layout with normalized geometric shapes (0-1000)
    layout_payload = {
        "name": "Planta Baja Canchariane",
        "view_box_w": 1000,
        "view_box_h": 1000,
        "courts": [
            {
                "court_id": court_id,
                "shape": {
                    "kind": "rect",
                    "x": 100.0,
                    "y": 100.0,
                    "w": 300.0,
                    "h": 200.0,
                    "rotation": 0.0,
                },
            }
        ],
        "decorations": [
            {
                "label": "Cafetería y Recepción",
                "icon": "coffee",
                "shape": {
                    "kind": "rect",
                    "x": 500.0,
                    "y": 100.0,
                    "w": 200.0,
                    "h": 150.0,
                    "rotation": 0.0,
                },
            }
        ],
    }

    put_resp = await api_client.put(
        f"/api/v1/clubs/{club.id}/layout",
        headers=headers,
        json=layout_payload,
    )
    assert put_resp.status_code == 200
    layout_data = put_resp.json()
    assert len(layout_data["courts"]) == 1
    assert len(layout_data["decorations"]) == 1

    # 2. GET layout verifies cached geometry and structure
    get_resp = await api_client.get(f"/api/v1/clubs/{club.id}/layout", headers=headers)
    assert get_resp.status_code == 200
    assert "public, max-age=" in get_resp.headers.get("Cache-Control", "")

    # 3. Server-Sent Events test
    sse_resp = await api_client.get(f"/api/v1/clubs/{club.id}/events", headers=headers)
    assert sse_resp.status_code == 200
    assert "text/event-stream" in sse_resp.headers["Content-Type"]
