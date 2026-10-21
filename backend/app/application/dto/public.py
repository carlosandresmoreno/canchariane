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
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    sports: list[str] = Field(default_factory=list)


class CourtPublicDTO(BaseModel):
    id: UUID
    name: str
    sport: str
    surface: str
    player_format: str
    is_covered: bool
    has_lighting: bool
    price_per_hour_cents: int | None = None


class BusinessHoursPublicDTO(BaseModel):
    weekday: int
    opens_at: str
    closes_at: str
    closes_next_day: bool


class CourtGroupPublicDTO(BaseModel):
    id: str
    name: str
    sport: str
    player_format: str
    surface: str | None = None
    is_covered: bool = False
    price_per_hour_cents: int
    court_ids: list[UUID]
    court_count: int
    selection_mode: str = "auto"  # "auto" | "manual"


class ClubPublicDetail(BaseModel):
    id: UUID
    slug: str
    name: str
    timezone: str
    address: str | None
    phone: str | None
    logo_url: str | None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    courts: list[CourtPublicDTO]
    business_hours: list[BusinessHoursPublicDTO]
    allowed_durations: list[int] = Field(default_factory=lambda: [60])
    default_duration: int = 60
    slot_step_minutes: int | None = None
    court_selection_mode: str = "manual"  # "manual" | "by_category"
    court_groups: list[CourtGroupPublicDTO] = Field(default_factory=list)


class SlotPublicDTO(BaseModel):
    court_id: UUID
    court_name: str
    period_start_utc: datetime
    period_end_utc: datetime
    local_start: str  # ISO string or HH:MM
    local_end: str
    price_cents: int
    hourly_rate_cents: int | None = None
    currency: str


class CreateHoldRequest(BaseModel):
    club_slug: str
    court_id: UUID | None = None
    group_id: str | None = None
    start_time: datetime  # ISO 8601 with timezone (e.g. 2026-10-20T18:00:00Z)
    duration_minutes: int = Field(default=60, ge=30, le=240)


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
