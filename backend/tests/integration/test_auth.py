import uuid

import pytest
import uuid6
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ClubMemberModel, ClubModel, UserModel
from app.infrastructure.security.password import hash_password
from app.main import app


@pytest.fixture
async def api_client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_user_registration_and_login_flow(api_client: AsyncClient) -> None:
    """Verifies complete registration, cookie issuance and subsequent login."""
    unique_email = f"user_{uuid.uuid4().hex}@example.com"
    password = "SecurePassword123!"

    # 1. Register
    reg_response = await api_client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": password,
            "full_name": "Carlos Moreno",
            "phone": "+573001234567",
        },
    )
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert "access_token" in reg_data
    assert "refresh_token" in reg_response.cookies

    # 2. Duplicate registration fails with 409 Conflict
    dup_response = await api_client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": password,
            "full_name": "Carlos Duplicate",
        },
    )
    assert dup_response.status_code == 409

    # 3. Login
    login_response = await api_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data
    assert "refresh_token" in login_response.cookies

    # 4. Access /me endpoint with Bearer token
    me_response = await api_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_data['access_token']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == unique_email


@pytest.mark.asyncio
async def test_rotating_refresh_token_and_reuse_detection(api_client: AsyncClient) -> None:
    """Verifies that refresh tokens rotate on each call and reuse of old token revokes the session."""
    unique_email = f"rotate_{uuid.uuid4().hex}@example.com"
    password = "SecurePassword123!"

    # Register
    reg_response = await api_client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": password, "full_name": "Rotate User"},
    )
    assert reg_response.status_code == 201
    first_refresh_cookie = reg_response.cookies["refresh_token"]

    # First rotation call with valid refresh_token cookie
    api_client.cookies.set("refresh_token", first_refresh_cookie)
    rot_response = await api_client.post("/api/v1/auth/refresh")
    assert rot_response.status_code == 200
    rot_data = rot_response.json()
    assert "access_token" in rot_data
    second_refresh_cookie = rot_response.cookies["refresh_token"]
    assert second_refresh_cookie != first_refresh_cookie

    # Attempt to REUSE the first refresh token (should trigger reuse detection)
    api_client.cookies.set("refresh_token", first_refresh_cookie)
    reuse_response = await api_client.post("/api/v1/auth/refresh")
    assert reuse_response.status_code == 401
    assert "Reutilización de token detectada" in reuse_response.json()["detail"]


@pytest.mark.asyncio
async def test_tenant_isolation_admin_club_a_receives_404_for_club_b(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """CRITICAL ACCEPTANCE CRITERION FOR PHASE 3:
    An admin of Club A receives 404 Not Found (NEVER 403) when attempting
    to access data from Club B, preventing club enumeration.
    """
    # 1. Create Club A and Club B
    club_a = ClubModel(
        id=uuid6.uuid7(),
        slug=f"club-a-{uuid.uuid4().hex}",
        name="Club Alpha",
        timezone="America/Bogota",
        is_published=True,
        subscription_status="active",
    )
    club_b = ClubModel(
        id=uuid6.uuid7(),
        slug=f"club-b-{uuid.uuid4().hex}",
        name="Club Beta",
        timezone="America/Bogota",
        is_published=True,
        subscription_status="active",
    )
    db_session.add_all([club_a, club_b])

    # 2. Create User Admin of Club A
    admin_a_email = f"admin_a_{uuid.uuid4().hex}@example.com"
    password = "AdminSecretPassword123!"
    user_admin_a = UserModel(
        id=uuid6.uuid7(),
        email=admin_a_email,
        password_hash=hash_password(password),
        full_name="Admin Club A",
        is_superadmin=False,
    )
    db_session.add(user_admin_a)

    # 3. Associate Admin A only with Club A
    membership_a = ClubMemberModel(
        id=uuid6.uuid7(),
        user_id=user_admin_a.id,
        club_id=club_a.id,
        role="admin",
        is_active=True,
    )
    db_session.add(membership_a)
    await db_session.commit()

    # 4. Login as Admin A
    login_resp = await api_client.post(
        "/api/v1/auth/login",
        json={"email": admin_a_email, "password": password},
    )
    assert login_resp.status_code == 200
    token_a = login_resp.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token_a}"}

    # 5. Access own Club A dashboard -> 200 OK!
    resp_own_club = await api_client.get(
        f"/api/v1/clubs/{club_a.id}/dashboard",
        headers=auth_headers,
    )
    assert resp_own_club.status_code == 200
    assert resp_own_club.json()["club_id"] == str(club_a.id)

    # 6. Access Club B dashboard -> MUST BE 404 NOT FOUND!
    resp_other_club = await api_client.get(
        f"/api/v1/clubs/{club_b.id}/dashboard",
        headers=auth_headers,
    )
    assert resp_other_club.status_code == 404
    assert resp_other_club.json()["detail"] == "Club no encontrado"
