from datetime import date, time
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class PricingRuleModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "pricing_rules"

    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    court_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("courts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    weekday_mask: Mapped[int] = mapped_column(
        Integer, nullable=False, default=127
    )  # Bitmask 0-6 (127=all days)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="COP", nullable=False)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    club = relationship("ClubModel", back_populates="pricing_rules")
    court = relationship("CourtModel", back_populates="pricing_rules")
