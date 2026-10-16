from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from uuid import UUID

from app.domain.exceptions import HoldExpiredError, InvalidBookingStatusTransitionError
from app.domain.value_objects.booking_code import BookingCode
from app.domain.value_objects.money import Money
from app.domain.value_objects.time_slot import TimeSlot


class BookingStatus(str, Enum):
    HELD = "held"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class PaymentStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"


ALLOWED_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    BookingStatus.HELD: {BookingStatus.CONFIRMED, BookingStatus.EXPIRED, BookingStatus.CANCELLED},
    BookingStatus.CONFIRMED: {
        BookingStatus.CANCELLED,
        BookingStatus.COMPLETED,
        BookingStatus.NO_SHOW,
    },
    BookingStatus.EXPIRED: set(),
    BookingStatus.CANCELLED: set(),
    BookingStatus.COMPLETED: set(),
    BookingStatus.NO_SHOW: set(),
}


@dataclass
class Booking:
    """Core domain entity representing a booking lifecycle."""

    id: UUID
    code: BookingCode
    club_id: UUID
    court_id: UUID
    period: TimeSlot
    status: BookingStatus
    customer_name: str
    customer_phone: str
    customer_email: str
    price: Money
    payment_status: PaymentStatus = PaymentStatus.NOT_REQUIRED
    expires_at: datetime | None = None
    user_id: UUID | None = None
    recurrence_id: UUID | None = None
    cancellation_reason: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def _transition_to(self, new_status: BookingStatus) -> None:
        if new_status not in ALLOWED_TRANSITIONS[self.status]:
            raise InvalidBookingStatusTransitionError(self.status.value, new_status.value)
        self.status = new_status
        self.updated_at = datetime.now(UTC)

    def confirm(self, now: datetime | None = None) -> None:
        current_time = now or datetime.now(UTC)
        if self.status == BookingStatus.HELD and self.expires_at and current_time > self.expires_at:
            self.expire()
            raise HoldExpiredError(str(self.id))
        self._transition_to(BookingStatus.CONFIRMED)
        self.expires_at = None

    def cancel(self, reason: str | None = None) -> None:
        self._transition_to(BookingStatus.CANCELLED)
        self.cancellation_reason = reason

    def expire(self) -> None:
        self._transition_to(BookingStatus.EXPIRED)

    def complete(self) -> None:
        self._transition_to(BookingStatus.COMPLETED)

    def mark_no_show(self) -> None:
        self._transition_to(BookingStatus.NO_SHOW)
