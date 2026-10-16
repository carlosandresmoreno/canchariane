from datetime import date, datetime, time
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# --- Geometric Shapes ---
class RectShape(BaseModel):
    kind: Literal["rect"] = "rect"
    x: float = Field(ge=0, le=1000)
    y: float = Field(ge=0, le=1000)
    w: float = Field(gt=0, le=1000)
    h: float = Field(gt=0, le=1000)
    rotation: float = 0


class PolygonShape(BaseModel):
    kind: Literal["polygon"] = "polygon"
    points: list[tuple[float, float]] = Field(min_length=3, max_length=24)

    def model_post_init(self, context: Any, /) -> None:
        for x, y in self.points:
            if not (0 <= x <= 1000 and 0 <= y <= 1000):
                raise ValueError(f"Polygon point ({x}, {y}) is outside viewbox 0..1000")


ShapeUnion = Annotated[RectShape | PolygonShape, Field(discriminator="kind")]


class DecorationItem(BaseModel):
    label: str
    shape: ShapeUnion
    icon: str | None = None


class CourtLayoutItem(BaseModel):
    court_id: UUID
    shape: ShapeUnion


class ClubLayoutUpdateRequest(BaseModel):
    name: str = "Planta Principal"
    view_box_w: int = 1000
    view_box_h: int = 1000
    courts: list[CourtLayoutItem]
    decorations: list[DecorationItem] = []


class ClubLayoutResponse(BaseModel):
    id: UUID
    club_id: UUID
    name: str
    view_box_w: int
    view_box_h: int
    courts: list[CourtLayoutItem]
    decorations: list[DecorationItem]


# --- Courts ---
class CourtCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sport: str = Field(min_length=2, max_length=50)
    surface: str = "synthetic_grass"
    player_format: str = "doubles"
    is_covered: bool = False
    has_lighting: bool = True
    position: int = 0
    shape: ShapeUnion | None = None


class CourtUpdateRequest(BaseModel):
    name: str | None = None
    sport: str | None = None
    surface: str | None = None
    player_format: str | None = None
    is_covered: bool | None = None
    has_lighting: bool | None = None
    is_active: bool | None = None
    position: int | None = None
    shape: ShapeUnion | None = None


class CourtAdminResponse(BaseModel):
    id: UUID
    club_id: UUID
    name: str
    sport: str
    surface: str
    player_format: str
    is_covered: bool
    has_lighting: bool
    is_active: bool
    position: int
    shape: dict[str, Any] | None
    created_at: datetime


# --- Business Hours ---
class BusinessHourItem(BaseModel):
    weekday: int = Field(ge=0, le=6)
    opens_at: time
    closes_at: time
    closes_next_day: bool = False


class BusinessHoursUpdateRequest(BaseModel):
    hours: list[BusinessHourItem]


class BusinessHoursAdminResponse(BaseModel):
    id: UUID
    weekday: int
    opens_at: str
    closes_at: str
    closes_next_day: bool


# --- Blocks ---
class BlockCreateRequest(BaseModel):
    court_id: UUID | None = None
    period_start: datetime
    period_end: datetime
    kind: str = "maintenance"
    reason: str | None = None


class BlockAdminResponse(BaseModel):
    id: UUID
    club_id: UUID
    court_id: UUID | None
    period_start: datetime
    period_end: datetime
    kind: str
    reason: str | None
    created_at: datetime


# --- Pricing Rules ---
class PricingRuleCreateRequest(BaseModel):
    court_id: UUID | None = None
    weekday_mask: int = Field(default=127, ge=1, le=127)
    start_time: time
    end_time: time
    price_cents: int = Field(gt=0)
    currency: str = "COP"
    valid_from: date | None = None
    valid_to: date | None = None


class PricingRuleUpdateRequest(BaseModel):
    court_id: UUID | None = None
    weekday_mask: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    price_cents: int | None = None
    currency: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class PricingRuleAdminResponse(BaseModel):
    id: UUID
    club_id: UUID
    court_id: UUID | None
    weekday_mask: int
    start_time: str
    end_time: str
    price_cents: int
    currency: str
    valid_from: date | None
    valid_to: date | None


# --- Admin Bookings ---
class AdminCreateBookingRequest(BaseModel):
    court_id: UUID
    period_start: datetime
    duration_minutes: int = Field(default=60, ge=30, le=240)
    customer_name: str = Field(min_length=2, max_length=100)
    customer_phone: str = Field(min_length=7, max_length=20)
    customer_email: EmailStr | None = None
    price_cents: int | None = None
    payment_status: str = "not_required"
    notes: str | None = None


class AdminUpdateBookingRequest(BaseModel):
    status: str | None = None  # confirmed, cancelled, no_show, completed
    payment_status: str | None = None
    cancellation_reason: str | None = None
    period_start: datetime | None = None
    court_id: UUID | None = None


class AdminBookingResponse(BaseModel):
    id: UUID
    code: str
    club_id: UUID
    court_id: UUID
    court_name: str
    period_start: datetime
    period_end: datetime
    status: str
    customer_name: str
    customer_phone: str
    customer_email: str
    price_cents: int
    currency: str
    payment_status: str
    cancellation_reason: str | None
    created_at: datetime
