from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class ClubModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "clubs"

    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="America/Bogota")
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    subscription_status: Mapped[str] = mapped_column(String(50), default="trial", nullable=False)
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    members = relationship("ClubMemberModel", back_populates="club", cascade="all, delete-orphan")
    courts = relationship("CourtModel", back_populates="club", cascade="all, delete-orphan")
    business_hours = relationship(
        "BusinessHoursModel", back_populates="club", cascade="all, delete-orphan"
    )
    pricing_rules = relationship(
        "PricingRuleModel", back_populates="club", cascade="all, delete-orphan"
    )
    blocks = relationship("BlockModel", back_populates="club", cascade="all, delete-orphan")
    bookings = relationship("BookingModel", back_populates="club", cascade="all, delete-orphan")
    store_sales = relationship("DailyStoreSaleModel", back_populates="club", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_clubs_slug_active", "slug", unique=True, postgresql_where=(deleted_at.is_(None))),
    )
