from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class ClubPublicSummary(BaseModel):
    id: UUID
    slug: str
    name: str
    timezone: str
    address: str | None
    phone: str | None
    logo_url: str | None


class CourtPublicDTO(BaseModel):
    id: UUID
    name: str
    sport: str
    surface: str
    player_format: str
    is_covered: bool
    has_lighting: bool


class BusinessHoursPublicDTO(BaseModel):
    weekday: int
    opens_at: str
    closes_at: str
    closes_next_day: bool


class ClubPublicDetail(BaseModel):
    id: UUID
    slug: str
    name: str
    timezone: str
    address: str | None
    phone: str | None
    logo_url: str | None
    courts: list[CourtPublicDTO]
    business_hours: list[BusinessHoursPublicDTO]


class SlotPublicDTO(BaseModel):
    court_id: UUID
    court_name: str
    period_start_utc: datetime
    period_end_utc: datetime
    local_start: str  # ISO string or HH:MM
    local_end: str
    price_cents: int
    currency: str


class CreateHoldRequest(BaseModel):
    club_slug: str
    court_id: UUID
    start_time: datetime  # ISO 8601 with timezone (e.g. 2026-10-20T18:00:00Z)
    duration_minutes: int = Field(default=60, ge=30, le=180)


class HoldResponse(BaseModel):
    hold_id: UUID
    code: str
    club_id: UUID
    court_id: UUID
    court_name: str
    period_start: datetime
    period_end: datetime
    price_cents: int
    currency: str
    expires_at: datetime


class ConfirmBookingRequest(BaseModel):
    hold_id: UUID
    customer_name: str = Field(min_length=2, max_length=100)
    customer_phone: str = Field(min_length=7, max_length=20)
    customer_email: EmailStr


class BookingPublicDTO(BaseModel):
    id: UUID
    code: str
    club_id: UUID
    court_id: UUID
    period_start: datetime
    period_end: datetime
    status: str
    customer_name: str
    customer_phone: str
    customer_email: str
    price_cents: int
    currency: str
    payment_status: str
    expires_at: datetime | None = None
    created_at: datetime


class CancelBookingRequest(BaseModel):
    phone: str | None = Field(default=None, max_length=20)
    reason: str | None = None
