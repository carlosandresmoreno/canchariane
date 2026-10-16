from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.value_objects.money import Money
from app.domain.value_objects.time_slot import TimeSlot


@dataclass(frozen=True)
class CourtInterval:
    """Represents an occupied interval (held or confirmed) bound to a court."""

    court_id: UUID
    period: TimeSlot


@dataclass(frozen=True)
class Slot:
    """A verified available booking slot."""

    court_id: UUID
    court_name: str
    period: TimeSlot  # UTC period for API and database operations
    local_start: datetime  # Local representation in club timezone
    local_end: datetime  # Local representation in club timezone
    price: Money
    status: str = "available"
