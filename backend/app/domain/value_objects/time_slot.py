from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


@dataclass(frozen=True)
class TimeSlot:
    """An immutable time interval representing a reservation, block, or candidate slot."""

    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.start >= self.end:
            raise ValueError(f"Start ({self.start}) must precede end ({self.end})")
        # Ensure UTC or timezone awareness
        if self.start.tzinfo is None or self.end.tzinfo is None:
            raise ValueError("TimeSlot timestamps must be timezone-aware")

    @property
    def duration(self) -> timedelta:
        return self.end - self.start

    def overlaps(self, other: "TimeSlot") -> bool:
        """PostgreSQL tstzrange '&&' semantics [start, end)."""
        return max(self.start, other.start) < min(self.end, other.end)

    def contains(self, dt: datetime) -> bool:
        """Checks if dt falls in [start, end)."""
        return self.start <= dt < self.end

    def to_utc(self) -> "TimeSlot":
        return TimeSlot(
            start=self.start.astimezone(UTC),
            end=self.end.astimezone(UTC),
        )
