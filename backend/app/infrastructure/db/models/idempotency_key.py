from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import uuid6
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.models.base import Base


class IdempotencyKeyModel(Base):
    __tablename__ = "idempotency_keys"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid6.uuid7,
    )
    key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    response_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
