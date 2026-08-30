"""bout engine: lots, соступ rounds, team bouts, bracket wiring

Adds the persistence behind the confirmed Mstinskaya Tradition ruleset:

* ``match_lots`` — the per-side жребий, append-only, with an override chain;
* ``match_rounds`` / ``match_round_scores`` — the соступ and its scoring events;
* ``team_bouts`` — the «трое на трое» phase;
* new ``matches`` columns for bracket wiring (byes, next-match advancement) and
  the frozen per-matchup win condition;
* new ``tournament_participants`` columns for the city constraint and for an
  entrant who has no platform profile yet.

Revision ID: 20260830_bout_engine
Revises: 20260826_auth_foundation
Create Date: 2026-08-30 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260830_bout_engine"
down_revision = "20260826_auth_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------- participants
    op.add_column("tournament_participants", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column(
        "tournament_participants", sa.Column("club_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        "tournament_participants", sa.Column("display_name", sa.String(length=150), nullable=True)
    )
    op.create_index(
        "ix_tournament_participants_club_id", "tournament_participants", ["club_id"], unique=False
    )

    # ---------------------------------------------------------------- matches
    op.add_column(
        "matches",
        sa.Column("is_bye", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("matches", sa.Column("next_match_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("matches", sa.Column("next_slot", sa.String(length=10), nullable=True))
    op.add_column("matches", sa.Column("final_weapon", sa.String(length=20), nullable=True))
    op.add_column("matches", sa.Column("required_rounds_red", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("required_rounds_blue", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("team_bout_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_matches_next_match_id", "matches", ["next_match_id"], unique=False)
    op.create_index("ix_matches_team_bout_id", "matches", ["team_bout_id"], unique=False)
    op.create_foreign_key(
        "fk_matches_next_match_id_matches", "matches", "matches", ["next_match_id"], ["id"], ondelete="SET NULL"
    )

    # ------------------------------------------------------------ team bouts
    op.create_table(
        "team_bouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_red_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_blue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="SCHEDULED"),
        sa.Column("wins_red", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wins_blue", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("winner_team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["competition_id"], ["competitions.id"], name="fk_team_bouts_competition_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["team_red_id"], ["competition_teams.id"], name="fk_team_bouts_team_red_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["team_blue_id"], ["competition_teams.id"], name="fk_team_bouts_team_blue_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["winner_team_id"],
            ["competition_teams.id"],
            name="fk_team_bouts_winner_team_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_team_bouts"),
    )
    op.create_index("ix_team_bouts_competition_id", "team_bouts", ["competition_id"], unique=False)
    op.create_index("ix_team_bouts_team_red_id", "team_bouts", ["team_red_id"], unique=False)
    op.create_index("ix_team_bouts_team_blue_id", "team_bouts", ["team_blue_id"], unique=False)
    op.create_foreign_key(
        "fk_matches_team_bout_id_team_bouts",
        "matches",
        "team_bouts",
        ["team_bout_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ----------------------------------------------------------- match lots
    op.create_table(
        "match_lots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("side", sa.String(length=10), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("die_value", sa.Integer(), nullable=False),
        sa.Column("weapon", sa.String(length=20), nullable=False),
        sa.Column("drawn_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], name="fk_match_lots_match_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["tournament_participants.id"],
            name="fk_match_lots_participant_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["drawn_by_user_id"], ["users.id"], name="fk_match_lots_drawn_by_user_id", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_match_lots"),
        sa.UniqueConstraint("match_id", "side", "sequence", name="uq_match_lots_match_side_sequence"),
    )
    op.create_index("ix_match_lots_match_id", "match_lots", ["match_id"], unique=False)
    op.create_index("ix_match_lots_participant_id", "match_lots", ["participant_id"], unique=False)
    op.create_index("ix_match_lots_drawn_by_user_id", "match_lots", ["drawn_by_user_id"], unique=False)

    # ------------------------------------------------------- соступ + scores
    op.create_table(
        "match_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="IN_PROGRESS"),
        sa.Column("points_red", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("points_blue", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("winner_participant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("end_reason", sa.String(length=30), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["match_id"], ["matches.id"], name="fk_match_rounds_match_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["winner_participant_id"],
            ["tournament_participants.id"],
            name="fk_match_rounds_winner_participant_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_match_rounds"),
        sa.UniqueConstraint("match_id", "round_number", name="uq_match_rounds_match_number"),
    )
    op.create_index("ix_match_rounds_match_id", "match_rounds", ["match_id"], unique=False)
    op.create_index(
        "ix_match_rounds_winner_participant_id", "match_rounds", ["winner_participant_id"], unique=False
    )

    op.create_table(
        "match_round_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("round_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_code", sa.String(length=30), nullable=False),
        sa.Column("weapon", sa.String(length=20), nullable=False),
        sa.Column("points", sa.Integer(), nullable=True),
        sa.Column("recorded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["round_id"], ["match_rounds.id"], name="fk_match_round_scores_round_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["tournament_participants.id"],
            name="fk_match_round_scores_participant_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by_user_id"],
            ["users.id"],
            name="fk_match_round_scores_recorded_by_user_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_match_round_scores"),
    )
    op.create_index("ix_match_round_scores_round_id", "match_round_scores", ["round_id"], unique=False)
    op.create_index(
        "ix_match_round_scores_participant_id", "match_round_scores", ["participant_id"], unique=False
    )


def downgrade() -> None:
    op.drop_table("match_round_scores")
    op.drop_table("match_rounds")
    op.drop_table("match_lots")

    op.drop_constraint("fk_matches_team_bout_id_team_bouts", "matches", type_="foreignkey")
    op.drop_table("team_bouts")

    op.drop_constraint("fk_matches_next_match_id_matches", "matches", type_="foreignkey")
    op.drop_index("ix_matches_team_bout_id", table_name="matches")
    op.drop_index("ix_matches_next_match_id", table_name="matches")
    for column in (
        "team_bout_id",
        "required_rounds_blue",
        "required_rounds_red",
        "final_weapon",
        "next_slot",
        "next_match_id",
        "is_bye",
    ):
        op.drop_column("matches", column)

    op.drop_index("ix_tournament_participants_club_id", table_name="tournament_participants")
    for column in ("display_name", "club_id", "city"):
        op.drop_column("tournament_participants", column)
