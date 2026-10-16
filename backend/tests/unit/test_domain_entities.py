from datetime import UTC, datetime, timedelta

import pytest
import uuid6

from app.domain.entities.booking import Booking, BookingStatus
from app.domain.exceptions import (
    HoldExpiredError,
    InvalidBookingStatusTransitionError,
)
from app.domain.value_objects.booking_code import BookingCode
from app.domain.value_objects.money import Money
from app.domain.value_objects.time_slot import TimeSlot


def test_money_value_object_arithmetic() -> None:
    m1 = Money(cents=4000000, currency="COP")
    m2 = Money(cents=2000000, currency="COP")

    assert m1.add(m2).cents == 6000000
    assert m1.subtract(m2).cents == 2000000
    assert m2.multiply(3).cents == 6000000
    assert m1.formatted == "$40.000 COP"

    with pytest.raises(ValueError):
        Money(cents=-100)


def test_booking_code_generation() -> None:
    code = BookingCode.generate(prefix="CAN")
    assert str(code).startswith("CAN-")
    assert len(str(code)) == 10  # CAN- + 6 chars
    # Ensure ambiguous characters are never generated
    for bad_char in ["0", "O", "1", "I", "L"]:
        assert bad_char not in str(code)[4:]


def test_time_slot_overlap_detection() -> None:
    now = datetime(2026, 10, 20, 18, 0, 0, tzinfo=UTC)
    slot1 = TimeSlot(start=now, end=now + timedelta(hours=1))  # 18:00 - 19:00
    slot2 = TimeSlot(
        start=now + timedelta(minutes=30), end=now + timedelta(minutes=90)
    )  # 18:30 - 19:30
    slot3 = TimeSlot(start=now + timedelta(hours=1), end=now + timedelta(hours=2))  # 19:00 - 20:00

    assert slot1.overlaps(slot2) is True
    assert slot2.overlaps(slot1) is True
    # Adjacent slots do not overlap in [start, end) interval arithmetic
    assert slot1.overlaps(slot3) is False


def test_booking_state_machine_held_to_confirmed() -> None:
    now = datetime.now(UTC)
    slot = TimeSlot(start=now + timedelta(days=1), end=now + timedelta(days=1, hours=1))
    booking = Booking(
        id=uuid6.uuid7(),
        code=BookingCode.generate(),
        club_id=uuid6.uuid7(),
        court_id=uuid6.uuid7(),
        period=slot,
        status=BookingStatus.HELD,
        customer_name="Juan",
        customer_phone="+573001234567",
        customer_email="juan@example.com",
        price=Money(cents=5000000),
        expires_at=now + timedelta(minutes=10),
    )

    booking.confirm(now=now + timedelta(minutes=5))
    assert booking.status == BookingStatus.CONFIRMED
    assert booking.expires_at is None


def test_booking_state_machine_expired_hold_raises_error() -> None:
    now = datetime.now(UTC)
    slot = TimeSlot(start=now + timedelta(days=1), end=now + timedelta(days=1, hours=1))
    booking = Booking(
        id=uuid6.uuid7(),
        code=BookingCode.generate(),
        club_id=uuid6.uuid7(),
        court_id=uuid6.uuid7(),
        period=slot,
        status=BookingStatus.HELD,
        customer_name="Juan",
        customer_phone="+573001234567",
        customer_email="juan@example.com",
        price=Money(cents=5000000),
        expires_at=now + timedelta(minutes=10),
    )

    # Attempt to confirm after expiration (11 mins later)
    with pytest.raises(HoldExpiredError):
        booking.confirm(now=now + timedelta(minutes=11))

    assert booking.status == BookingStatus.EXPIRED


def test_booking_invalid_transition_cancelled_to_confirmed() -> None:
    now = datetime.now(UTC)
    slot = TimeSlot(start=now + timedelta(days=1), end=now + timedelta(days=1, hours=1))
    booking = Booking(
        id=uuid6.uuid7(),
        code=BookingCode.generate(),
        club_id=uuid6.uuid7(),
        court_id=uuid6.uuid7(),
        period=slot,
        status=BookingStatus.CANCELLED,
        customer_name="Juan",
        customer_phone="+573001234567",
        customer_email="juan@example.com",
        price=Money(cents=5000000),
    )

    with pytest.raises(InvalidBookingStatusTransitionError):
        booking.confirm()
