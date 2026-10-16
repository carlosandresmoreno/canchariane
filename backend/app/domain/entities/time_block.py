from dataclasses import dataclass
from uuid import UUID

from app.domain.value_objects.time_slot import TimeSlot


@dataclass
class TimeBlock:
    """Represents a scheduled closure, tournament, or maintenance."""

    id: UUID
    club_id: UUID
    period: TimeSlot
    kind: str  # maintenance, tournament, weather, closure, other
    court_id: UUID | None = None  # None = applies to all courts of the club
    reason: str | None = None
