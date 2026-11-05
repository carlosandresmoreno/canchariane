"""0005 add origin column to bookings

Revision ID: 0005_booking_origin
Revises: 0004_daily_store_sales
Create Date: 2026-11-05 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_booking_origin"
down_revision: str | None = "0004_daily_store_sales"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("origin", sa.String(length=20), server_default="public", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("bookings", "origin")

