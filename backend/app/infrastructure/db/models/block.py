from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import TSTZRANGE
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class BlockModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "blocks"

    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
    )
    court_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("courts.id", ondelete="CASCADE"),
        nullable=True,
    )
    period: Mapped[Any] = mapped_column(TSTZRANGE, nullable=False)
    kind: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # maintenance, tournament, weather, closure, other
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    club = relationship("ClubModel", back_populates="blocks")
    court = relationship("CourtModel", back_populates="blocks")

    __table_args__ = (
        Index("ix_blocks_club_period_gist", "club_id", "period", postgresql_using="gist"),
    )
