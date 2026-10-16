import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from app.config import settings


def create_access_token(
    *,
    user_id: UUID,
    email: str,
    full_name: str,
    is_superadmin: bool,
    memberships: list[dict[str, str]],
    expires_delta: timedelta | None = None,
) -> str:
    """Generates a 15-minute access JWT containing identity, roles and tenant memberships."""
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "full_name": full_name,
        "is_superadmin": is_superadmin,
        "memberships": memberships,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decodes and validates the signature and expiration of an access JWT."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        return payload
    except jwt.PyJWTError:
        return None


def hash_refresh_token(raw_token: str) -> str:
    """Hashes an opaque refresh token using SHA-256 for secure database lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
    """Generates an opaque, cryptographically secure 64-char refresh token and its hash."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw_token)
    return raw_token, token_hash
