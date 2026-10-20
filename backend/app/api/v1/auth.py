from datetime import UTC, datetime, timedelta
from typing import Annotated

import uuid6
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.application.dto.auth import (
    LoginRequest,
    MembershipDTO,
    RegisterRequest,
    TokenResponse,
    UserContext,
    UserResponse,
)
from app.config import settings
from app.infrastructure.db.models import RefreshTokenModel, UserModel
from app.infrastructure.security.jwt import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from app.infrastructure.security.password import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    # 1. Check existing email
    query = select(UserModel).where(UserModel.email == data.email.lower().strip())
    existing = await db.scalar(query)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con este correo electrónico",
        )

    # 2. Create user with Argon2id hash
    user_id = uuid6.uuid7()
    user = UserModel(
        id=user_id,
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        phone=data.phone.strip() if data.phone else None,
        is_superadmin=False,
    )
    db.add(user)

    # 3. Generate initial session and rotating refresh token
    family_id = uuid6.uuid7()
    raw_refresh, token_hash = generate_refresh_token()
    refresh_record = RefreshTokenModel(
        id=uuid6.uuid7(),
        user_id=user_id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_record)
    await db.commit()

    # 4. Generate access token
    access_token = create_access_token(
        user_id=user_id,
        email=user.email,
        full_name=user.full_name,
        is_superadmin=False,
        memberships=[],
    )

    _set_refresh_cookie(response, raw_refresh)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    # 1. Retrieve user with memberships
    query = (
        select(UserModel)
        .where(UserModel.email == data.email.lower().strip())
        .options(selectinload(UserModel.memberships))
    )
    user = await db.scalar(query)

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    # 2. Extract active memberships
    memberships = [
        {"club_id": str(m.club_id), "role": m.role} for m in user.memberships if m.is_active
    ]

    # 3. Create access token and refresh token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_superadmin=user.is_superadmin,
        memberships=memberships,
    )

    family_id = uuid6.uuid7()
    raw_refresh, token_hash = generate_refresh_token()
    refresh_record = RefreshTokenModel(
        id=uuid6.uuid7(),
        user_id=user.id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_record)
    await db.commit()

    _set_refresh_cookie(response, raw_refresh)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cookie de refresh token no encontrada",
        )

    token_hash = hash_refresh_token(refresh_token)
    query = select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
    record = await db.scalar(query)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )

    # Token reuse detection: if already revoked, invalidate entire family!
    if record.is_revoked:
        revoke_query = (
            update(RefreshTokenModel)
            .where(RefreshTokenModel.family_id == record.family_id)
            .values(is_revoked=True, revoked_at=datetime.now(UTC))
        )
        await db.execute(revoke_query)
        await db.commit()
        response.delete_cookie("refresh_token", path="/api/v1/auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reutilización de token detectada. Sesión invalidada por seguridad.",
        )

    # Check expiration
    if record.expires_at < datetime.now(UTC):
        record.is_revoked = True
        record.revoked_at = datetime.now(UTC)
        await db.commit()
        response.delete_cookie("refresh_token", path="/api/v1/auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expirado",
        )

    # Rotate: revoke current and issue new with same family_id
    record.is_revoked = True
    record.revoked_at = datetime.now(UTC)

    new_raw_refresh, new_token_hash = generate_refresh_token()
    new_record = RefreshTokenModel(
        id=uuid6.uuid7(),
        user_id=record.user_id,
        token_hash=new_token_hash,
        family_id=record.family_id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_record)

    # Fetch user for fresh memberships
    user_query = (
        select(UserModel)
        .where(UserModel.id == record.user_id)
        .options(selectinload(UserModel.memberships))
    )
    user = await db.scalar(user_query)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )

    memberships = [
        {"club_id": str(m.club_id), "role": m.role} for m in user.memberships if m.is_active
    ]
    new_access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_superadmin=user.is_superadmin,
        memberships=memberships,
    )

    await db.commit()
    _set_refresh_cookie(response, new_raw_refresh)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> None:
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        query = (
            update(RefreshTokenModel)
            .where(RefreshTokenModel.token_hash == token_hash)
            .values(is_revoked=True, revoked_at=datetime.now(UTC))
        )
        await db.execute(query)
        await db.commit()

    response.delete_cookie("refresh_token", path="/")


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    query = (
        select(UserModel)
        .where(UserModel.id == current_user.id)
        .options(selectinload(UserModel.memberships))
    )
    user = await db.scalar(query)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    memberships = [
        MembershipDTO(club_id=str(m.club_id), role=m.role) for m in user.memberships if m.is_active
    ]

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_superadmin=user.is_superadmin,
        memberships=memberships,
    )
