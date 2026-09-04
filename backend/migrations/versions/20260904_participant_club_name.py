"""club on the entry, for the first-round separation

``docs/tournament-engine.md`` lists ``avoid_same_club`` alongside
``avoid_same_city``, but only the city was ever an input to the draw.
``tournament_participants.club_id`` has existed since the bout engine and is
read on output, yet nothing ever fed it to the seeding algorithm — and it could
not have: it is a bare UUID with no foreign key, while entries arrive naming a
club in free text that frequently matches no row.

So the club joins the constraint as text on the entry, symmetric with ``city``
and for the same reason stated in that column's docstring: a fighter who
changes school later must not retroactively change which school they
represented at a past event. ``club_id`` keeps its existing meaning and is set
additionally when a name does resolve; the constraint never depends on it.

Revision ID: 20260904_participant_club_name
Revises: 20260830_bout_engine
Create Date: 2026-09-04 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260904_participant_club_name"
down_revision = "20260830_bout_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tournament_participants",
        sa.Column("club_name", sa.String(length=150), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tournament_participants", "club_name")
