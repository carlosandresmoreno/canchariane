from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    phone: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MembershipDTO(BaseModel):
    club_id: str
    role: str  # owner, admin, staff


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: str | None
    is_superadmin: bool
    memberships: list[MembershipDTO]


@dataclass(frozen=True)
class UserContext:
    """Authenticated user context resolved from request token."""

    id: UUID
    email: str
    full_name: str
    is_superadmin: bool
    memberships: dict[UUID, str]  # club_id -> role

    def has_club_role(self, club_id: UUID, min_role: str) -> bool:
        if self.is_superadmin:
            return True

        user_role = self.memberships.get(club_id)
        if not user_role:
            return False

        hierarchy = {"staff": 1, "admin": 2, "owner": 3}
        required_level = hierarchy.get(min_role, 2)
        user_level = hierarchy.get(user_role, 0)
        return user_level >= required_level
