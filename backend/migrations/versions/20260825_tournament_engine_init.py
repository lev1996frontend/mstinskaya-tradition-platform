"""tournament engine foundation

Revision ID: 20260825_tournament_engine_init
Revises: 20260825_equipment_init
Create Date: 2026-08-25 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260825_tournament_engine_init"
down_revision = "20260825_equipment_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "competitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("competition_type", sa.String(length=20), nullable=False, server_default="INDIVIDUAL"),
        sa.Column("format", sa.String(length=30), nullable=False, server_default="SINGLE_ELIMINATION"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competitions_tournament_id", "competitions", ["tournament_id"])

    op.create_table(
        "competition_teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("short_name", sa.String(length=50), nullable=True),
        sa.Column("club_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("captain_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competition_teams_competition_id", "competition_teams", ["competition_id"])
    op.create_index("ix_competition_teams_club_id", "competition_teams", ["club_id"])
    op.create_index("ix_competition_teams_captain_id", "competition_teams", ["captain_id"])

    op.create_table(
        "competition_team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["competition_teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "athlete_id", name="uq_competition_team_members_team_athlete"),
    )
    op.create_index("ix_competition_team_members_team_id", "competition_team_members", ["team_id"])
    op.create_index("ix_competition_team_members_athlete_id", "competition_team_members", ["athlete_id"])

    op.create_table(
        "competition_draws",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("draw_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competition_draws_competition_id", "competition_draws", ["competition_id"])

    op.create_table(
        "competition_brackets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("draw_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("stage_type", sa.String(length=30), nullable=False),
        sa.Column("round_count", sa.Integer(), nullable=True),
        sa.Column("round", sa.String(length=30), nullable=True),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["draw_id"], ["competition_draws.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competition_brackets_competition_id", "competition_brackets", ["competition_id"])
    op.create_index("ix_competition_brackets_draw_id", "competition_brackets", ["draw_id"])

    op.add_column("tournament_participants", sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("tournament_participants", sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("tournament_participants", sa.Column("seed", sa.Integer(), nullable=True))
    op.alter_column("tournament_participants", "athlete_id", nullable=True)
    op.alter_column("tournament_participants", "category_id", nullable=True)
    op.create_foreign_key("fk_tournament_participants_competition_id_competitions", "tournament_participants", "competitions", ["competition_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_tournament_participants_team_id_competition_teams", "tournament_participants", "competition_teams", ["team_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_tournament_participants_competition_id", "tournament_participants", ["competition_id"])
    op.create_index("ix_tournament_participants_team_id", "tournament_participants", ["team_id"])

    op.add_column("matches", sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("matches", sa.Column("draw_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("matches", sa.Column("bracket_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("matches", sa.Column("round_number", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("position", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("stage_name", sa.String(length=30), nullable=True))
    op.alter_column("matches", "category_id", nullable=True)
    op.create_foreign_key("fk_matches_competition_id_competitions", "matches", "competitions", ["competition_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_matches_draw_id_competition_draws", "matches", "competition_draws", ["draw_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_matches_bracket_id_competition_brackets", "matches", "competition_brackets", ["bracket_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_matches_competition_id", "matches", ["competition_id"])
    op.create_index("ix_matches_draw_id", "matches", ["draw_id"])
    op.create_index("ix_matches_bracket_id", "matches", ["bracket_id"])

    op.create_table(
        "match_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("winner_participant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("result_type", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["winner_participant_id"], ["tournament_participants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id"),
    )
    op.create_index("ix_match_results_match_id", "match_results", ["match_id"])

    op.create_table(
        "participant_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["participant_id"], ["tournament_participants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_participant_status_history_participant_id", "participant_status_history", ["participant_id"])

    op.create_table(
        "competition_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("competition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competition_events_competition_id", "competition_events", ["competition_id"])


def downgrade() -> None:
    op.drop_index("ix_competition_events_competition_id", table_name="competition_events")
    op.drop_table("competition_events")
    op.drop_index("ix_participant_status_history_participant_id", table_name="participant_status_history")
    op.drop_table("participant_status_history")
    op.drop_index("ix_match_results_match_id", table_name="match_results")
    op.drop_table("match_results")
    for name in ("ix_matches_bracket_id", "ix_matches_draw_id", "ix_matches_competition_id"):
        op.drop_index(name, table_name="matches")
    for name in ("fk_matches_bracket_id_competition_brackets", "fk_matches_draw_id_competition_draws", "fk_matches_competition_id_competitions"):
        op.drop_constraint(name, "matches", type_="foreignkey")
    for name in ("stage_name", "position", "round_number", "bracket_id", "draw_id", "competition_id"):
        op.drop_column("matches", name)
    for name in ("ix_tournament_participants_team_id", "ix_tournament_participants_competition_id"):
        op.drop_index(name, table_name="tournament_participants")
    op.drop_constraint("fk_tournament_participants_team_id_competition_teams", "tournament_participants", type_="foreignkey")
    op.drop_constraint("fk_tournament_participants_competition_id_competitions", "tournament_participants", type_="foreignkey")
    op.alter_column("tournament_participants", "athlete_id", nullable=False)
    op.alter_column("tournament_participants", "category_id", nullable=False)
    for name in ("seed", "team_id", "competition_id"):
        op.drop_column("tournament_participants", name)
    op.drop_index("ix_competition_brackets_draw_id", table_name="competition_brackets")
    op.drop_index("ix_competition_teams_captain_id", table_name="competition_teams")
    op.drop_index("ix_competition_teams_club_id", table_name="competition_teams")
    op.drop_index("ix_competition_brackets_competition_id", table_name="competition_brackets")
    op.drop_table("competition_brackets")
    op.drop_index("ix_competition_draws_competition_id", table_name="competition_draws")
    op.drop_table("competition_draws")
    op.drop_index("ix_competition_team_members_athlete_id", table_name="competition_team_members")
    op.drop_index("ix_competition_team_members_team_id", table_name="competition_team_members")
    op.drop_table("competition_team_members")
    op.drop_index("ix_competition_teams_competition_id", table_name="competition_teams")
    op.drop_table("competition_teams")
    op.drop_index("ix_competitions_tournament_id", table_name="competitions")
    op.drop_table("competitions")
