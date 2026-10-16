from dataclasses import dataclass
from datetime import date, time
from uuid import UUID

from app.domain.value_objects.money import Money


@dataclass(frozen=True)
class PricingRule:
    """Pricing rule defining rates by court, weekday, and time window."""

    id: UUID
    club_id: UUID
    court_id: UUID | None
    weekday_mask: int  # Bitmask 0-6: bit 0 = Monday (1 << 0), bit 6 = Sunday (1 << 6)
    start_time: time
    end_time: time
    price: Money
    valid_from: date | None = None
    valid_to: date | None = None

    def matches(self, target_court_id: UUID, slot_time: time, slot_day: date) -> bool:
        # 1. Weekday bitmask check
        weekday = slot_day.weekday()
        if not (self.weekday_mask & (1 << weekday)):
            return False

        # 2. Date validity window
        if self.valid_from and slot_day < self.valid_from:
            return False
        if self.valid_to and slot_day > self.valid_to:
            return False

        # 3. Court matching: either exact match or fallback to club-level (court_id is None)
        if self.court_id is not None and self.court_id != target_court_id:
            return False

        # 4. Time window: slot_time in [start_time, end_time)
        return self.start_time <= slot_time < self.end_time
