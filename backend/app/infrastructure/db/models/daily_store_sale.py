from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class DailyStoreSaleModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "daily_store_sales"

    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sale_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    club = relationship("ClubModel", back_populates="store_sales")

    __table_args__ = (
        UniqueConstraint("club_id", "sale_date", name="uq_club_daily_store_sale"),
    )
