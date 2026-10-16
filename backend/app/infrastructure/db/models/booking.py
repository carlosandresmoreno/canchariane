from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import TSTZRANGE, ExcludeConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class BookingModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "bookings"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
    )
    court_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("courts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    period: Mapped[Any] = mapped_column(TSTZRANGE, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="COP", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="not_required", nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recurrence_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    club = relationship("ClubModel", back_populates="bookings")
    court = relationship("CourtModel", back_populates="bookings")
    user = relationship("UserModel", back_populates="bookings")
    events = relationship(
        "BookingEventModel", back_populates="booking", cascade="all, delete-orphan"
    )
    payments = relationship("PaymentModel", back_populates="booking", cascade="all, delete-orphan")

    __table_args__ = (
        ExcludeConstraint(
            ("court_id", "="),
            ("period", "&&"),
            name="bookings_no_overlap",
            using="gist",
            where=text("status IN ('held', 'confirmed')"),
        ),
        Index(
            "ix_bookings_court_period_gist",
            "court_id",
            "period",
            postgresql_using="gist",
            postgresql_where=text("status IN ('held', 'confirmed')"),
        ),
        Index("ix_bookings_club_period_lower", "club_id", text("lower(period) DESC")),
        Index("ix_bookings_code", "code"),
    )
