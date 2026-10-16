from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
import uuid6
from hypothesis import given
from hypothesis import settings as hyp_settings
from hypothesis import strategies as st

from app.domain.entities.business_hours import BusinessHours
from app.domain.entities.court import Court
from app.domain.entities.pricing_rule import PricingRule
from app.domain.entities.time_block import TimeBlock
from app.domain.services.availability import compute_slots
from app.domain.value_objects.money import Money
from app.domain.value_objects.slot import CourtInterval
from app.domain.value_objects.time_slot import TimeSlot


@pytest.fixture
def bogota_tz() -> ZoneInfo:
    return ZoneInfo("America/Bogota")


@pytest.fixture
def sample_courts() -> tuple[Court, Court]:
    club_id = uuid6.uuid7()
    c1 = Court(
        id=uuid6.uuid7(),
        club_id=club_id,
        name="Cancha 1",
        sport="padel",
        surface="synthetic_grass",
        player_format="doubles",
        is_active=True,
        position=1,
    )
    c2 = Court(
        id=uuid6.uuid7(),
        club_id=club_id,
        name="Cancha 2",
        sport="padel",
        surface="synthetic_grass",
        player_format="doubles",
        is_active=True,
        position=2,
    )
    return c1, c2


def test_closed_day_returns_empty_list(
    bogota_tz: ZoneInfo, sample_courts: tuple[Court, Court]
) -> None:
    """When business_hours is None, the club is closed and compute_slots returns []."""
    c1, c2 = sample_courts
    day = date(2026, 10, 20)
    now = datetime(2026, 10, 20, 8, 0, 0, tzinfo=bogota_tz)

    slots = compute_slots(
        day=day,
        tz=bogota_tz,
        business_hours=None,
        courts=[c1, c2],
        occupied=[],
        blocks=[],
        pricing_rules=[],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=30),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )
    assert slots == []


def test_closing_past_midnight_closes_next_day(
    bogota_tz: ZoneInfo,
    sample_courts: tuple[Court, Court],
) -> None:
    """Verifies that operating hours spanning past midnight (e.g. 18:00 to 02:00 next day)
    properly generate slots across midnight.
    """
    c1, _ = sample_courts
    day = date(2026, 10, 20)
    now = datetime(2026, 10, 20, 12, 0, 0, tzinfo=bogota_tz)

    # 18:00 to 02:00 (next day)
    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(18, 0),
        closes_at=time(2, 0),
        closes_next_day=True,
    )

    slots = compute_slots(
        day=day,
        tz=bogota_tz,
        business_hours=hours,
        courts=[c1],
        occupied=[],
        blocks=[],
        pricing_rules=[],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=30),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )

    assert len(slots) > 0
    # First slot: 18:00 - 19:00 on day
    assert slots[0].local_start == datetime(2026, 10, 20, 18, 0, tzinfo=bogota_tz)
    assert slots[0].local_end == datetime(2026, 10, 20, 19, 0, tzinfo=bogota_tz)

    # Last slot: 01:00 - 02:00 on next day
    assert slots[-1].local_start == datetime(2026, 10, 21, 1, 0, tzinfo=bogota_tz)
    assert slots[-1].local_end == datetime(2026, 10, 21, 2, 0, tzinfo=bogota_tz)

    # Check a slot crossing midnight: 23:30 (day) to 00:30 (next day)
    midnight_slots = [
        s for s in slots if s.local_start == datetime(2026, 10, 20, 23, 30, tzinfo=bogota_tz)
    ]
    assert len(midnight_slots) == 1
    assert midnight_slots[0].local_end == datetime(2026, 10, 21, 0, 30, tzinfo=bogota_tz)


def test_min_lead_time_discards_slots_too_soon(
    bogota_tz: ZoneInfo,
    sample_courts: tuple[Court, Court],
) -> None:
    """Slots starting prior to now + min_lead_time must be discarded."""
    c1, _ = sample_courts
    day = date(2026, 10, 20)
    # Current time is 14:15. With 30 min lead time, earliest start allowed is 14:45.
    now = datetime(2026, 10, 20, 14, 15, 0, tzinfo=bogota_tz)

    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(8, 0),
        closes_at=time(22, 0),
        closes_next_day=False,
    )

    slots = compute_slots(
        day=day,
        tz=bogota_tz,
        business_hours=hours,
        courts=[c1],
        occupied=[],
        blocks=[],
        pricing_rules=[],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=30),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )

    for slot in slots:
        assert slot.local_start >= datetime(2026, 10, 20, 14, 45, tzinfo=bogota_tz)

    # The first valid slot in a 30m grid from 08:00 is 15:00 (14:30 is < 14:45)
    assert slots[0].local_start == datetime(2026, 10, 20, 15, 0, tzinfo=bogota_tz)


def test_active_booking_eliminates_overlapping_candidates(
    bogota_tz: ZoneInfo,
    sample_courts: tuple[Court, Court],
) -> None:
    """An existing booking from 18:00 to 19:00 on Court 1 eliminates overlapping slots on Court 1
    (e.g., 17:30-18:30, 18:00-19:00, 18:30-19:30), but allows adjacent slots and Court 2.
    """
    c1, c2 = sample_courts
    day = date(2026, 10, 20)
    now = datetime(2026, 10, 20, 8, 0, 0, tzinfo=bogota_tz)

    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(16, 0),
        closes_at=time(21, 0),
        closes_next_day=False,
    )

    # Booking on Court 1 from 18:00 to 19:00 UTC
    booking_utc_start = datetime(2026, 10, 20, 18, 0, tzinfo=bogota_tz).astimezone(UTC)
    booking_utc_end = datetime(2026, 10, 20, 19, 0, tzinfo=bogota_tz).astimezone(UTC)
    occupied = [
        CourtInterval(
            court_id=c1.id,
            period=TimeSlot(start=booking_utc_start, end=booking_utc_end),
        )
    ]

    slots = compute_slots(
        day=day,
        tz=bogota_tz,
        business_hours=hours,
        courts=[c1, c2],
        occupied=occupied,
        blocks=[],
        pricing_rules=[],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=30),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )

    c1_slots = [s for s in slots if s.court_id == c1.id]
    c2_slots = [s for s in slots if s.court_id == c2.id]

    # Verify Court 1 has no slots overlapping 18:00-19:00
    for s in c1_slots:
        local_slot = TimeSlot(start=s.local_start, end=s.local_end)
        booking_local = TimeSlot(
            start=datetime(2026, 10, 20, 18, 0, tzinfo=bogota_tz),
            end=datetime(2026, 10, 20, 19, 0, tzinfo=bogota_tz),
        )
        assert not local_slot.overlaps(booking_local)

    # Adjacent slots exist on Court 1
    c1_adjacent_before = [
        s for s in c1_slots if s.local_start == datetime(2026, 10, 20, 17, 0, tzinfo=bogota_tz)
    ]
    c1_adjacent_after = [
        s for s in c1_slots if s.local_start == datetime(2026, 10, 20, 19, 0, tzinfo=bogota_tz)
    ]
    assert len(c1_adjacent_before) == 1
    assert len(c1_adjacent_after) == 1

    # Court 2 has the 18:00 slot available
    c2_18_slot = [
        s for s in c2_slots if s.local_start == datetime(2026, 10, 20, 18, 0, tzinfo=bogota_tz)
    ]
    assert len(c2_18_slot) == 1


def test_club_wide_and_court_blocks(
    bogota_tz: ZoneInfo,
    sample_courts: tuple[Court, Court],
) -> None:
    """Club-wide blocks (court_id=None) block all courts; court-specific blocks only block target court."""
    c1, c2 = sample_courts
    day = date(2026, 10, 20)
    now = datetime(2026, 10, 20, 8, 0, 0, tzinfo=bogota_tz)

    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(8, 0),
        closes_at=time(18, 0),
        closes_next_day=False,
    )

    # 1. Club-wide block: 09:00 - 11:00 (Tournament)
    club_block_utc = TimeSlot(
        start=datetime(2026, 10, 20, 9, 0, tzinfo=bogota_tz).astimezone(UTC),
        end=datetime(2026, 10, 20, 11, 0, tzinfo=bogota_tz).astimezone(UTC),
    )
    # 2. Court 1 specific block: 14:00 - 16:00 (Maintenance)
    c1_block_utc = TimeSlot(
        start=datetime(2026, 10, 20, 14, 0, tzinfo=bogota_tz).astimezone(UTC),
        end=datetime(2026, 10, 20, 16, 0, tzinfo=bogota_tz).astimezone(UTC),
    )

    blocks = [
        TimeBlock(
            id=uuid6.uuid7(),
            club_id=c1.club_id,
            court_id=None,
            period=club_block_utc,
            kind="tournament",
        ),
        TimeBlock(
            id=uuid6.uuid7(),
            club_id=c1.club_id,
            court_id=c1.id,
            period=c1_block_utc,
            kind="maintenance",
        ),
    ]

    slots = compute_slots(
        day=day,
        tz=bogota_tz,
        business_hours=hours,
        courts=[c1, c2],
        occupied=[],
        blocks=blocks,
        pricing_rules=[],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=30),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )

    # Neither court has slots overlapping 09:00 - 11:00
    for s in slots:
        assert not (
            datetime(2026, 10, 20, 9, 0, tzinfo=bogota_tz)
            <= s.local_start
            < datetime(2026, 10, 20, 11, 0, tzinfo=bogota_tz)
        )

    # Court 1 has no slots during 14:00 - 16:00
    c1_slots = [s for s in slots if s.court_id == c1.id]
    for s in c1_slots:
        assert not (
            datetime(2026, 10, 20, 14, 0, tzinfo=bogota_tz)
            <= s.local_start
            < datetime(2026, 10, 20, 16, 0, tzinfo=bogota_tz)
        )

    # Court 2 DOES have slots available at 14:00 and 15:00
    c2_14_slot = [
        s
        for s in slots
        if s.court_id == c2.id and s.local_start == datetime(2026, 10, 20, 14, 0, tzinfo=bogota_tz)
    ]
    assert len(c2_14_slot) == 1


def test_pricing_rule_resolution_hierarchy(
    bogota_tz: ZoneInfo,
    sample_courts: tuple[Court, Court],
) -> None:
    """Specific court pricing rule overrides club-level pricing rule."""
    c1, c2 = sample_courts
    day = date(2026, 10, 20)  # Tuesday, weekday 1
    now = datetime(2026, 10, 20, 8, 0, 0, tzinfo=bogota_tz)

    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(8, 0),
        closes_at=time(22, 0),
        closes_next_day=False,
    )

    club_level_rule = PricingRule(
        id=uuid6.uuid7(),
        club_id=c1.club_id,
        court_id=None,  # All courts
        weekday_mask=127,
        start_time=time(18, 0),
        end_time=time(22, 0),
        price=Money(cents=5000000),  # $50.000 COP
    )

    court_1_premium_rule = PricingRule(
        id=uuid6.uuid7(),
        club_id=c1.club_id,
        court_id=c1.id,  # Court 1 specifically
        weekday_mask=127,
        start_time=time(18, 0),
        end_time=time(22, 0),
        price=Money(cents=7000000),  # $70.000 COP
    )

    slots = compute_slots(
        day=day,
        tz=bogota_tz,
        business_hours=hours,
        courts=[c1, c2],
        occupied=[],
        blocks=[],
        pricing_rules=[club_level_rule, court_1_premium_rule],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=60),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )

    # At 18:00, Court 1 gets $70.000 (specific), Court 2 gets $50.000 (fallback)
    c1_18 = next(
        s
        for s in slots
        if s.court_id == c1.id and s.local_start == datetime(2026, 10, 20, 18, 0, tzinfo=bogota_tz)
    )
    c2_18 = next(
        s
        for s in slots
        if s.court_id == c2.id and s.local_start == datetime(2026, 10, 20, 18, 0, tzinfo=bogota_tz)
    )

    assert c1_18.price.cents == 7000000
    assert c2_18.price.cents == 5000000


def test_dst_transition_preserves_local_hours() -> None:
    """Verifies that DST transition (e.g. Madrid spring forward 2026-03-29)
    does not drift or produce invalid slots.
    """
    madrid_tz = ZoneInfo("Europe/Madrid")
    court = Court(
        id=uuid6.uuid7(),
        club_id=uuid6.uuid7(),
        name="Cancha Madrid",
        sport="padel",
        surface="synthetic_grass",
        player_format="doubles",
        is_active=True,
        position=1,
    )
    # European DST spring forward: 2026-03-29
    day = date(2026, 3, 29)
    now = datetime(2026, 3, 29, 0, 0, 0, tzinfo=madrid_tz)

    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(8, 0),
        closes_at=time(20, 0),
        closes_next_day=False,
    )

    slots = compute_slots(
        day=day,
        tz=madrid_tz,
        business_hours=hours,
        courts=[court],
        occupied=[],
        blocks=[],
        pricing_rules=[],
        duration=timedelta(minutes=60),
        step=timedelta(minutes=60),
        now=now,
        min_lead_time=timedelta(minutes=30),
    )

    assert len(slots) > 0
    # Every slot has exactly 60 minute duration in local time
    for s in slots:
        assert s.local_end - s.local_start == timedelta(minutes=60)
        assert s.period.duration == timedelta(minutes=60)


# Property-based testing with Hypothesis
@given(
    open_hour=st.integers(min_value=6, max_value=12),
    close_hour=st.integers(min_value=14, max_value=23),
    duration_min=st.sampled_from([30, 60, 90]),
    step_min=st.sampled_from([15, 30, 60]),
)
@hyp_settings(max_examples=30)
def test_hypothesis_invariants(
    open_hour: int,
    close_hour: int,
    duration_min: int,
    step_min: int,
) -> None:
    """Hypothesis invariant verification:
    - Every slot duration == duration_min
    - Every slot starts >= opening
    - Every slot ends <= closing
    """
    tz = ZoneInfo("UTC")
    day = date(2026, 10, 20)
    now = datetime(2026, 10, 20, 0, 0, 0, tzinfo=tz)

    court = Court(
        id=uuid6.uuid7(),
        club_id=uuid6.uuid7(),
        name="Hypothesis Court",
        sport="padel",
        surface="synthetic_grass",
        player_format="doubles",
        is_active=True,
    )

    hours = BusinessHours(
        weekday=day.weekday(),
        opens_at=time(open_hour, 0),
        closes_at=time(close_hour, 0),
        closes_next_day=False,
    )

    duration = timedelta(minutes=duration_min)
    step = timedelta(minutes=step_min)

    slots = compute_slots(
        day=day,
        tz=tz,
        business_hours=hours,
        courts=[court],
        occupied=[],
        blocks=[],
        pricing_rules=[],
        duration=duration,
        step=step,
        now=now,
        min_lead_time=timedelta(minutes=0),
    )

    opening_dt = datetime.combine(day, time(open_hour, 0), tzinfo=tz)
    closing_dt = datetime.combine(day, time(close_hour, 0), tzinfo=tz)

    for slot in slots:
        assert slot.local_end - slot.local_start == duration
        assert slot.local_start >= opening_dt
        assert slot.local_end <= closing_dt
