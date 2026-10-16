from datetime import UTC, datetime

import asyncpg
import pytest
import uuid6
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.value_objects import BookingCode
from app.infrastructure.db.models import BookingModel, ClubModel, CourtModel


@pytest.mark.asyncio
async def test_gist_exclusion_constraint_rejects_overlapping_bookings_same_court(
    db_session: AsyncSession,
    seed_club_and_court: tuple[ClubModel, CourtModel, CourtModel],
) -> None:
    """Verifies the core architectural invariant:
    Two active (held/confirmed) bookings on the same court with overlapping periods
    MUST BE REJECTED by PostgreSQL EXCLUDE USING gist constraint.
    """
    club, court_1, _ = seed_club_and_court

    start_1 = datetime(2026, 10, 20, 18, 0, 0, tzinfo=UTC)
    end_1 = datetime(2026, 10, 20, 19, 0, 0, tzinfo=UTC)
    period_1 = asyncpg.Range(start_1, end_1, lower_inc=True, upper_inc=False)

    # 1. Insert first booking (Confirmed: 18:00 - 19:00)
    booking_1 = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=period_1,
        status="confirmed",
        customer_name="Carlos Moreno",
        customer_phone="+573001234567",
        customer_email="carlos@example.com",
        price_cents=6000000,
        currency="COP",
    )
    db_session.add(booking_1)
    await db_session.commit()

    # 2. Attempt to insert overlapping booking on the SAME court (Held: 18:30 - 19:30)
    start_2 = datetime(2026, 10, 20, 18, 30, 0, tzinfo=UTC)
    end_2 = datetime(2026, 10, 20, 19, 30, 0, tzinfo=UTC)
    period_2 = asyncpg.Range(start_2, end_2, lower_inc=True, upper_inc=False)

    booking_overlap = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=period_2,
        status="held",
        customer_name="Andres Perez",
        customer_phone="+573009876543",
        customer_email="andres@example.com",
        price_cents=6000000,
        currency="COP",
    )
    db_session.add(booking_overlap)

    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()

    # Verify that the failure comes directly from the exclusion constraint
    error_message = str(exc_info.value).lower()
    assert "bookings_no_overlap" in error_message or "exclusion" in error_message


@pytest.mark.asyncio
async def test_gist_allows_overlapping_period_on_different_courts(
    db_session: AsyncSession,
    seed_club_and_court: tuple[ClubModel, CourtModel, CourtModel],
) -> None:
    """Overlapping periods on DIFFERENT courts must be allowed."""
    club, court_1, court_2 = seed_club_and_court

    start = datetime(2026, 10, 20, 20, 0, 0, tzinfo=UTC)
    end = datetime(2026, 10, 20, 21, 0, 0, tzinfo=UTC)
    period = asyncpg.Range(start, end, lower_inc=True, upper_inc=False)

    booking_court_1 = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=period,
        status="confirmed",
        customer_name="Jugador 1",
        customer_phone="+573001111111",
        customer_email="j1@example.com",
        price_cents=5000000,
        currency="COP",
    )
    booking_court_2 = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_2.id,
        period=period,
        status="confirmed",
        customer_name="Jugador 2",
        customer_phone="+573002222222",
        customer_email="j2@example.com",
        price_cents=5000000,
        currency="COP",
    )

    db_session.add_all([booking_court_1, booking_court_2])
    await db_session.commit()
    assert booking_court_1.id is not None
    assert booking_court_2.id is not None


@pytest.mark.asyncio
async def test_gist_allows_adjacent_non_overlapping_slots(
    db_session: AsyncSession,
    seed_club_and_court: tuple[ClubModel, CourtModel, CourtModel],
) -> None:
    """Adjacent slots [18:00, 19:00) and [19:00, 20:00) do NOT overlap."""
    club, court_1, _ = seed_club_and_court

    slot1 = asyncpg.Range(
        datetime(2026, 10, 21, 18, 0, 0, tzinfo=UTC),
        datetime(2026, 10, 21, 19, 0, 0, tzinfo=UTC),
        lower_inc=True,
        upper_inc=False,
    )
    slot2 = asyncpg.Range(
        datetime(2026, 10, 21, 19, 0, 0, tzinfo=UTC),
        datetime(2026, 10, 21, 20, 0, 0, tzinfo=UTC),
        lower_inc=True,
        upper_inc=False,
    )

    b1 = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=slot1,
        status="confirmed",
        customer_name="Jugador A",
        customer_phone="+573001111111",
        customer_email="ja@example.com",
        price_cents=5000000,
        currency="COP",
    )
    b2 = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=slot2,
        status="confirmed",
        customer_name="Jugador B",
        customer_phone="+573002222222",
        customer_email="jb@example.com",
        price_cents=5000000,
        currency="COP",
    )

    db_session.add_all([b1, b2])
    await db_session.commit()
    assert b1.id is not None
    assert b2.id is not None


@pytest.mark.asyncio
async def test_cancelled_booking_does_not_block_new_booking(
    db_session: AsyncSession,
    seed_club_and_court: tuple[ClubModel, CourtModel, CourtModel],
) -> None:
    """When a booking is cancelled, its slot can be re-booked immediately
    because the exclusion constraint has WHERE status IN ('held', 'confirmed').
    """
    club, court_1, _ = seed_club_and_court

    slot = asyncpg.Range(
        datetime(2026, 10, 22, 18, 0, 0, tzinfo=UTC),
        datetime(2026, 10, 22, 19, 0, 0, tzinfo=UTC),
        lower_inc=True,
        upper_inc=False,
    )

    cancelled_booking = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=slot,
        status="cancelled",
        customer_name="Jugador Cancelado",
        customer_phone="+573001111111",
        customer_email="jc@example.com",
        price_cents=5000000,
        currency="COP",
        cancellation_reason="Cliente canceló",
    )
    db_session.add(cancelled_booking)
    await db_session.commit()

    # Re-book the same exact slot
    new_booking = BookingModel(
        id=uuid6.uuid7(),
        code=BookingCode.generate().value,
        club_id=club.id,
        court_id=court_1.id,
        period=slot,
        status="confirmed",
        customer_name="Jugador Nuevo",
        customer_phone="+573002222222",
        customer_email="jn@example.com",
        price_cents=5000000,
        currency="COP",
    )
    db_session.add(new_booking)
    await db_session.commit()
    assert new_booking.id is not None
