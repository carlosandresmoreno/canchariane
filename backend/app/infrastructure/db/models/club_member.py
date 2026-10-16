from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.models.base import Base, TimestampMixin, UUIDv7PKMixin


class ClubMemberModel(Base, UUIDv7PKMixin, TimestampMixin):
    __tablename__ = "club_members"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    club_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # owner, admin, staff
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("UserModel", back_populates="memberships")
    club = relationship("ClubModel", back_populates="members")

    __table_args__ = (
        UniqueConstraint("user_id", "club_id", name="uq_club_members_user_club"),
        Index("ix_club_members_user_club", "user_id", "club_id"),
    )
