"""the achievement's issue date, which the model has always declared

``Achievement.issued_date`` was declared on the model but no migration ever
created the column, so every insert into ``achievements`` named a column that
does not exist on Postgres. The suite never caught it: each test file builds
its schema with ``Base.metadata.create_all`` against in-memory SQLite, where
the column is generated from the model and the drift is invisible. It surfaces
only against a database the migrations actually built.

The column follows the rest of the table: a naive ``DateTime`` — the shape
``20260825_ratings_init`` gave ``earned_at``, ``created_at`` and ``updated_at``
— and nullable, as the model's ``datetime | None`` says. Existing rows keep a
null issue date rather than being told a date they never had.

Revision ID: 20260905_achievement_issued_date
Revises: 20260905_competition_age_gap
Create Date: 2026-09-05 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260905_achievement_issued_date"
down_revision = "20260905_competition_age_gap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "achievements",
        sa.Column("issued_date", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("achievements", "issued_date")
