"""who stepped into whose place

A replacement is a row of its own, not an edit of the row that left — the
fighter who withdrew keeps their entry, their status and their history intact,
and the stand-in gets a new entry that takes over the vacated seat. This column
is the link between the two.

It is recorded on the replacement, pointing back at the departed, because a
reserve can stand in for different people in different disciplines while a
given entry has exactly one predecessor. ``SET NULL`` rather than ``CASCADE``:
if the departed entry is ever deleted the stand-in is still a real competitor
with real results, and must not be deleted along with it.

Revision ID: 20260905_participant_replacement
Revises: 20260905_unique_indexes
Create Date: 2026-09-05 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260905_participant_replacement"
down_revision = "20260905_unique_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tournament_participants",
        sa.Column("replaces_participant_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_tournament_participants_replaces_participant_id",
        "tournament_participants",
        ["replaces_participant_id"],
    )
    op.create_foreign_key(
        "fk_tournament_participants_replaces_participant_id",
        "tournament_participants",
        "tournament_participants",
        ["replaces_participant_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tournament_participants_replaces_participant_id",
        "tournament_participants",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_tournament_participants_replaces_participant_id",
        table_name="tournament_participants",
    )
    op.drop_column("tournament_participants", "replaces_participant_id")
