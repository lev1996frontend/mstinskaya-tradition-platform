"""subgroups for the group stage

``GROUP_PLAYOFF`` and ``ROUND_ROBIN`` have been selectable formats since the
engine landed, and ``STAGE_ORDER["GROUP"]`` has been reserved just as long, but
nothing ever produced a group: there was no container to deal fighters into.

``competition_groups`` is that container. ``ordinal`` is not decoration — it is
what the cross-seeding reads when it lays qualifiers out as A1, B1, A2, B2, so
the order of the groups is part of the playoff's shape. ``advance_count`` is
snapshotted per group so that changing the setting later cannot rewrite what
actually happened, which is the same "preserve history" rule the rest of the
schema follows.

Nothing here stores a standings table. A group's table is derived from recorded
results on read, like every other standings view; a stored copy would be a
second source of truth and would quietly get around «НЕ храним очки».

Group bouts themselves need no new table or column: they are ordinary
``matches`` rows with ``stage_name = 'GROUP'`` and no ``next_match_id``.

Revision ID: 20260904_competition_groups
Revises: 20260904_competition_eligibility
Create Date: 2026-09-04 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260904_competition_groups"
down_revision = "20260904_competition_eligibility"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "competition_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "competition_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("competitions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "draw_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("competition_draws.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("advance_count", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("competition_id", "ordinal", name="uq_group_ordinal"),
    )

    op.add_column(
        "tournament_participants",
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_participants_group_id_competition_groups",
        "tournament_participants",
        "competition_groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_tournament_participants_group_id", "tournament_participants", ["group_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_tournament_participants_group_id", table_name="tournament_participants")
    op.drop_constraint(
        "fk_participants_group_id_competition_groups",
        "tournament_participants",
        type_="foreignkey",
    )
    op.drop_column("tournament_participants", "group_id")
    op.drop_table("competition_groups")
