from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class BusinessHours:
    """Operating hours for a club on a specific weekday."""

    weekday: int  # 0=Monday, 6=Sunday
    opens_at: time
    closes_at: time
    closes_next_day: bool = False

    def __post_init__(self) -> None:
        if not (0 <= self.weekday <= 6):
            raise ValueError(f"Weekday must be 0-6, got {self.weekday}")
        if not self.closes_next_day and self.opens_at >= self.closes_at:
            raise ValueError(
                f"opens_at ({self.opens_at}) must precede closes_at ({self.closes_at}) "
                f"unless closes_next_day is True"
            )
