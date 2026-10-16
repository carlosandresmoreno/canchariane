from collections.abc import Callable
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.auth import UserContext
from app.infrastructure.db.session import get_async_session
from app.infrastructure.security.jwt import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    async for session in get_async_session():
        yield session


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
) -> UserContext:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de autenticación no proporcionadas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    memberships_list: list[dict[str, str]] = payload.get("memberships", [])
    memberships_dict: dict[UUID, str] = {
        UUID(m["club_id"]): m["role"] for m in memberships_list if "club_id" in m and "role" in m
    }

    return UserContext(
        id=UUID(user_id_str),
        email=payload.get("email", ""),
        full_name=payload.get("full_name", ""),
        is_superadmin=payload.get("is_superadmin", False),
        memberships=memberships_dict,
    )


def require_club_role(min_role: str = "staff") -> Callable[..., Any]:
    """Dependency factory checking that current user has at least min_role on club_id.

    CRITICAL INVARIANT: Returns 404 Not Found (NEVER 403) when user lacks membership,
    preventing malicious scanning of existing club UUIDs.
    """

    async def _verifier(
        club_id: UUID,
        current_user: Annotated[UserContext, Depends(get_current_user)],
    ) -> tuple[UUID, UserContext]:
        if not current_user.has_club_role(club_id, min_role):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Club no encontrado",
            )
        return club_id, current_user

    return _verifier


async def require_superadmin(
    current_user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a superadministradores",
        )
    return current_user
