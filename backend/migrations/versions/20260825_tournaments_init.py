"""Initial tournament tables.

Revision ID: 20260825_tournaments_init
Revises: 20260825_rules_judging_init
Create Date: 2026-08-25 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_tournaments_init"
down_revision = "20260825_rules_judging_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("organizer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ruleset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organizer_id"], ["users.id"], name="fk_tournaments_organizer_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ruleset_id"], ["rule_sets.id"], name="fk_tournaments_ruleset_id_rule_sets", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_tournaments"),
    )
    op.create_index(op.f("ix_tournaments_title"), "tournaments", ["title"], unique=False)
    op.create_index(op.f("ix_tournaments_organizer_id"), "tournaments", ["organizer_id"], unique=False)
    op.create_index(op.f("ix_tournaments_ruleset_id"), "tournaments", ["ruleset_id"], unique=False)

    op.create_table(
        "tournament_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], name="fk_tournament_categories_tournament_id_tournaments", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_tournament_categories"),
    )
    op.create_index(op.f("ix_tournament_categories_tournament_id"), "tournament_categories", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_categories_name"), "tournament_categories", ["name"], unique=False)

    op.create_table(
        "tournament_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="REGISTERED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], name="fk_tournament_participants_tournament_id_tournaments", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["tournament_categories.id"], name="fk_tournament_participants_category_id_tournament_categories", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], name="fk_tournament_participants_athlete_id_athletes", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_tournament_participants"),
    )
    op.create_index(op.f("ix_tournament_participants_tournament_id"), "tournament_participants", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_participants_category_id"), "tournament_participants", ["category_id"], unique=False)
    op.create_index(op.f("ix_tournament_participants_athlete_id"), "tournament_participants", ["athlete_id"], unique=False)

    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_red_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("participant_blue_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="SCHEDULED"),
        sa.Column("winner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], name="fk_matches_tournament_id_tournaments", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["tournament_categories.id"], name="fk_matches_category_id_tournament_categories", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["participant_red_id"], ["tournament_participants.id"], name="fk_matches_participant_red_id_tournament_participants", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["participant_blue_id"], ["tournament_participants.id"], name="fk_matches_participant_blue_id_tournament_participants", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["winner_id"], ["tournament_participants.id"], name="fk_matches_winner_id_tournament_participants", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_matches"),
    )
    op.create_index(op.f("ix_matches_tournament_id"), "matches", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_matches_category_id"), "matches", ["category_id"], unique=False)
    op.create_index(op.f("ix_matches_participant_red_id"), "matches", ["participant_red_id"], unique=False)
    op.create_index(op.f("ix_matches_participant_blue_id"), "matches", ["participant_blue_id"], unique=False)
    op.create_index(op.f("ix_matches_winner_id"), "matches", ["winner_id"], unique=False)

    op.create_table(
        "judge_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("judge_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="SIDE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], name="fk_judge_assignments_match_id_matches", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["judge_id"], ["users.id"], name="fk_judge_assignments_judge_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_judge_assignments"),
    )
    op.create_index(op.f("ix_judge_assignments_match_id"), "judge_assignments", ["match_id"], unique=False)
    op.create_index(op.f("ix_judge_assignments_judge_id"), "judge_assignments", ["judge_id"], unique=False)

    op.create_table(
        "match_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("decision_type", sa.String(length=20), nullable=False),
        sa.Column("winner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], name="fk_match_decisions_match_id_matches", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["winner_id"], ["tournament_participants.id"], name="fk_match_decisions_winner_id_tournament_participants", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_match_decisions"),
    )
    op.create_index(op.f("ix_match_decisions_match_id"), "match_decisions", ["match_id"], unique=False)
    op.create_index(op.f("ix_match_decisions_winner_id"), "match_decisions", ["winner_id"], unique=False)

    op.create_table(
        "tournament_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False, server_default="RULES"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], name="fk_tournament_documents_tournament_id_tournaments", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_tournament_documents"),
    )
    op.create_index(op.f("ix_tournament_documents_tournament_id"), "tournament_documents", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_documents_title"), "tournament_documents", ["title"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tournament_documents_title"), table_name="tournament_documents")
    op.drop_index(op.f("ix_tournament_documents_tournament_id"), table_name="tournament_documents")
    op.drop_table("tournament_documents")

    op.drop_index(op.f("ix_match_decisions_winner_id"), table_name="match_decisions")
    op.drop_index(op.f("ix_match_decisions_match_id"), table_name="match_decisions")
    op.drop_table("match_decisions")

    op.drop_index(op.f("ix_judge_assignments_judge_id"), table_name="judge_assignments")
    op.drop_index(op.f("ix_judge_assignments_match_id"), table_name="judge_assignments")
    op.drop_table("judge_assignments")

    op.drop_index(op.f("ix_matches_winner_id"), table_name="matches")
    op.drop_index(op.f("ix_matches_participant_blue_id"), table_name="matches")
    op.drop_index(op.f("ix_matches_participant_red_id"), table_name="matches")
    op.drop_index(op.f("ix_matches_category_id"), table_name="matches")
    op.drop_index(op.f("ix_matches_tournament_id"), table_name="matches")
    op.drop_table("matches")

    op.drop_index(op.f("ix_tournament_participants_athlete_id"), table_name="tournament_participants")
    op.drop_index(op.f("ix_tournament_participants_category_id"), table_name="tournament_participants")
    op.drop_index(op.f("ix_tournament_participants_tournament_id"), table_name="tournament_participants")
    op.drop_table("tournament_participants")

    op.drop_index(op.f("ix_tournament_categories_name"), table_name="tournament_categories")
    op.drop_index(op.f("ix_tournament_categories_tournament_id"), table_name="tournament_categories")
    op.drop_table("tournament_categories")

    op.drop_index(op.f("ix_tournaments_ruleset_id"), table_name="tournaments")
    op.drop_index(op.f("ix_tournaments_organizer_id"), table_name="tournaments")
    op.drop_index(op.f("ix_tournaments_title"), table_name="tournaments")
    op.drop_table("tournaments")
