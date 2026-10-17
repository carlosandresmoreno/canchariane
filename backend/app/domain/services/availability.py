from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.domain.entities.business_hours import BusinessHours
from app.domain.entities.court import Court
from app.domain.entities.pricing_rule import PricingRule
from app.domain.entities.time_block import TimeBlock
from app.domain.value_objects.money import Money
from app.domain.value_objects.slot import CourtInterval, Slot
from app.domain.value_objects.time_slot import TimeSlot


def compute_slots(
    *,
    day: date,
    tz: ZoneInfo,
    business_hours: BusinessHours | None,
    courts: Sequence[Court],
    occupied: Sequence[CourtInterval],
    blocks: Sequence[TimeBlock],
    pricing_rules: Sequence[PricingRule],
    duration: timedelta,
    step: timedelta,
    now: datetime,
    min_lead_time: timedelta,
    default_price: Money | None = None,
) -> list[Slot]:
    """Pure domain function that generates and filters available candidate slots for a given day.

    Zero I/O, zero framework dependencies, deterministic and testable.
    """
    # 1. Day is closed if business hours are missing
    if business_hours is None:
        return []

    active_courts = [c for c in courts if c.is_active]
    if not active_courts:
        return []

    # 2. Construct operating boundaries in club's local timezone (protects against DST shifts)
    opening_dt = datetime.combine(day, business_hours.opens_at, tzinfo=tz)
    closing_day = day + timedelta(days=1) if business_hours.closes_next_day else day
    closing_dt = datetime.combine(closing_day, business_hours.closes_at, tzinfo=tz)

    if opening_dt >= closing_dt:
        return []

    # 3. Discard starts prior to now + min_lead_time
    now_in_tz = now.astimezone(tz)
    earliest_allowed = now_in_tz + min_lead_time

    # Pre-index occupied and block intervals by court for fast lookup
    # None key in blocks_by_court represents club-wide blocks
    occupied_by_court: dict[str, list[TimeSlot]] = {}
    for occ in occupied:
        occupied_by_court.setdefault(str(occ.court_id), []).append(occ.period)

    blocks_by_court: dict[str | None, list[TimeSlot]] = {}
    for blk in blocks:
        key = str(blk.court_id) if blk.court_id else None
        blocks_by_court.setdefault(key, []).append(blk.period)

    available_slots: list[Slot] = []

    # 4. Generate candidate starts every 'step' minutes
    candidate_start = opening_dt
    while candidate_start + duration <= closing_dt:
        candidate_end = candidate_start + duration

        # Check lead time
        if candidate_start >= earliest_allowed:
            # Build UTC interval for database/query comparison
            slot_utc = TimeSlot(
                start=candidate_start.astimezone(UTC),
                end=candidate_end.astimezone(UTC),
            )

            # Check each active court
            for court in active_courts:
                court_id_str = str(court.id)

                # Check club-wide blocks or court-specific blocks
                is_blocked = False
                club_blocks = blocks_by_court.get(None, [])
                court_blocks = blocks_by_court.get(court_id_str, [])
                for blk_slot in club_blocks + court_blocks:
                    if blk_slot.overlaps(slot_utc):
                        is_blocked = True
                        break

                if is_blocked:
                    continue

                # Check bookings / holds on this court
                is_occupied = False
                court_occupied = occupied_by_court.get(court_id_str, [])
                for occ_slot in court_occupied:
                    if occ_slot.overlaps(slot_utc):
                        is_occupied = True
                        break

                if is_occupied:
                    continue

                # 5. Resolve pricing rule (specific court takes precedence over club-level)
                slot_price: Money | None = None
                matched_rule: PricingRule | None = None

                # First attempt specific court rules
                for rule in pricing_rules:
                    if rule.court_id == court.id and rule.matches(
                        court.id, candidate_start.time(), candidate_start.date()
                    ):
                        matched_rule = rule
                        break

                # Fallback to club-level rules (court_id is None)
                if matched_rule is None:
                    for rule in pricing_rules:
                        if rule.court_id is None and rule.matches(
                            court.id, candidate_start.time(), candidate_start.date()
                        ):
                            matched_rule = rule
                            break

                if matched_rule:
                    base_price = matched_rule.price
                elif default_price:
                    base_price = default_price
                else:
                    base_price = Money(cents=0, currency="COP")

                # Scale price proportionally with duration relative to 60-minute base
                if duration != timedelta(minutes=60) and base_price.cents > 0:
                    scaled_cents = int(round(base_price.cents * (duration.total_seconds() / 3600.0)))
                    slot_price = Money(cents=scaled_cents, currency=base_price.currency)
                else:
                    slot_price = base_price

                available_slots.append(
                    Slot(
                        court_id=court.id,
                        court_name=court.name,
                        period=slot_utc,
                        local_start=candidate_start,
                        local_end=candidate_end,
                        price=slot_price,
                        status="available",
                        hourly_rate=base_price,
                    )
                )

        candidate_start += step

    # Sort deterministically by local start time, then court position, then name
    court_map = {c.id: c for c in active_courts}
    available_slots.sort(
        key=lambda s: (s.local_start, court_map[s.court_id].position, s.court_name)
    )

    return available_slots
