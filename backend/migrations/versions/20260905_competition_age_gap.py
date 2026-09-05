"""age streams inside one category

An «Абсолютная детская» holding both an eight-year-old and a fourteen-year-old
cannot be drawn as one field. The fix is not a fixed list of age groups — those
differ between events — but a single number per discipline: the largest age
difference allowed inside one bracket. From it and the actual entrants the
platform derives the streams.

Null everywhere until an organizer sets it, so nothing changes for a category
that fights as one field, which is every adult one.

Revision ID: 20260905_competition_age_gap
Revises: 20260904_competition_groups
Create Date: 2026-09-05 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260905_competition_age_gap"
down_revision = "20260904_competition_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("competitions", sa.Column("max_age_gap", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("competitions", "max_age_gap")
