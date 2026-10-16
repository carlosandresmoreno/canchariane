from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class ClubLayoutModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "club_layouts"

    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), default="Planta Principal", nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    view_box_w: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    view_box_h: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    background_blob_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decorations: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    club = relationship("ClubModel")
