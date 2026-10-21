from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class CourtModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "courts"

    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sport: Mapped[str] = mapped_column(String(50), nullable=False)
    surface: Mapped[str] = mapped_column(String(50), nullable=False)
    player_format: Mapped[str] = mapped_column(String(20), nullable=False)
    is_covered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_lighting: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shape: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    layout_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    club = relationship("ClubModel", back_populates="courts")
    bookings = relationship("BookingModel", back_populates="court", cascade="all, delete-orphan", passive_deletes=True)
    pricing_rules = relationship("PricingRuleModel", back_populates="court", cascade="all, delete-orphan", passive_deletes=True)
    blocks = relationship("BlockModel", back_populates="court", cascade="all, delete-orphan", passive_deletes=True)
