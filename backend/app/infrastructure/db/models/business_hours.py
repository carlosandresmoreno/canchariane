from datetime import time
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, SmallInteger, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class BusinessHoursModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "business_hours"

    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
    )
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Monday, 6=Sunday
    opens_at: Mapped[time] = mapped_column(Time, nullable=False)
    closes_at: Mapped[time] = mapped_column(Time, nullable=False)
    closes_next_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    club = relationship("ClubModel", back_populates="business_hours")

    __table_args__ = (
        UniqueConstraint("club_id", "weekday", name="uq_business_hours_club_weekday"),
    )
