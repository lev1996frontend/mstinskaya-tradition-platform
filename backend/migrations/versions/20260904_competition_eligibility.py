"""categories as disciplines, with optional age bounds

Three related gaps close together.

``tournament_categories`` was a name and a description that nothing pointed at.
``Participant.category_id`` and ``Match.category_id`` both existed, and both
were filled by picking the tournament's *oldest* category and stamping it on
everything — which was harmless while a tournament had one category and wrong
the moment it had two. ``competitions.category_id`` gives those columns a real
answer: an entry inherits the category of the discipline it is entered in.

Age bounds live on the discipline and are independently optional. «Ветераны» is
45+, «Абсолютная детская» carries an upper bound, and the general adult
absolute carries neither — which is what lets a fifty-year-old enter both the
veterans' category and the open one. Both null means the platform never asks
for a birth year at all.

``birth_year`` is on the entry, not only on ``athletes``, because an entrant
imported from a spreadsheet has no profile to read it from, and because
age-at-this-event is a fact about this entry. It matches the precision the
athletes domain already keeps: a year, not a date.

Revision ID: 20260904_competition_eligibility
Revises: 20260904_participant_club_name
Create Date: 2026-09-04 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260904_competition_eligibility"
down_revision = "20260904_participant_club_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "competitions",
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_competitions_category_id_tournament_categories",
        "competitions",
        "tournament_categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_competitions_category_id", "competitions", ["category_id"])
    op.add_column("competitions", sa.Column("min_age", sa.Integer(), nullable=True))
    op.add_column("competitions", sa.Column("max_age", sa.Integer(), nullable=True))

    op.add_column(
        "tournament_participants",
        sa.Column("birth_year", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tournament_participants", "birth_year")
    op.drop_column("competitions", "max_age")
    op.drop_column("competitions", "min_age")
    op.drop_index("ix_competitions_category_id", table_name="competitions")
    op.drop_constraint(
        "fk_competitions_category_id_tournament_categories", "competitions", type_="foreignkey"
    )
    op.drop_column("competitions", "category_id")
