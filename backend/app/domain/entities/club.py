from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo


@dataclass
class Club:
    """Root tenant domain entity."""

    id: UUID
    slug: str
    name: str
    timezone: ZoneInfo
    is_published: bool = False
    subscription_status: str = "trial"  # trial, active, past_due, canceled
    address: str | None = None
    phone: str | None = None
    logo_url: str | None = None
    paid_until: datetime | None = None
    settings: dict[str, Any] = field(default_factory=dict)
    deleted_at: datetime | None = None

    @property
    def is_active(self) -> bool:
        return self.deleted_at is None and self.subscription_status in ("trial", "active")

    @property
    def is_bookable(self) -> bool:
        return self.is_published and self.is_active
