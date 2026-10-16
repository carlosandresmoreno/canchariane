from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SuperadminClubCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    timezone: str = Field(default="America/Bogota")
    currency: str = Field(default="COP")
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    subscription_status: Literal["trial", "active", "suspended", "cancelled"] = "active"
    is_published: bool = True
    admin_user_email: EmailStr | None = None


class SuperadminClubUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    timezone: str | None = None
    subscription_status: Literal["trial", "active", "suspended", "cancelled"] | None = None
    is_published: bool | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None


class SuperadminClubResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    timezone: str
    currency: str
    subscription_status: str
    is_published: bool
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    courts_count: int = 0
    members_count: int = 0
    created_at: datetime


class SuperadminMembershipCreateRequest(BaseModel):
    user_email: EmailStr
    role: Literal["owner", "admin", "staff"] = "admin"


class SuperadminMembershipResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    user_full_name: str
    club_id: UUID
    role: str
    is_active: bool
    created_at: datetime


class SuperadminStatsResponse(BaseModel):
    total_clubs: int
    active_clubs: int
    published_clubs: int
    total_courts: int
    total_users: int
    total_bookings: int
