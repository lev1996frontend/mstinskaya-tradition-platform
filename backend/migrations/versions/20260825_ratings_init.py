"""ratings init

Revision ID: 20260825_ratings_init
Revises: 20260825_tournaments_init
Create Date: 2026-08-25 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_ratings_init"
down_revision = "20260825_tournaments_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rating_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("losses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("draws", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tier", sa.String(length=50), nullable=False, server_default="unranked"),
        sa.Column("last_calculated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("athlete_id"),
    )
    op.create_index(op.f("ix_rating_profiles_athlete_id"), "rating_profiles", ["athlete_id"], unique=False)

    op.create_table(
        "rating_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("delta", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("previous_rating", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("new_rating", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_rating_events_athlete_id"), "rating_events", ["athlete_id"], unique=False)
    op.create_index(op.f("ix_rating_events_source_id"), "rating_events", ["source_id"], unique=False)

    op.create_table(
        "achievements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("award_type", sa.String(length=50), nullable=False, server_default="achievement"),
        sa.Column("earned_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_achievements_athlete_id"), "achievements", ["athlete_id"], unique=False)

    op.create_table(
        "athlete_competitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("place", sa.Integer(), nullable=True),
        sa.Column("result", sa.String(length=20), nullable=False, server_default="PARTICIPANT"),
        sa.Column("matches_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wins_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("losses_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["tournament_categories.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_athlete_competitions_athlete_id"), "athlete_competitions", ["athlete_id"], unique=False)
    op.create_index(op.f("ix_athlete_competitions_tournament_id"), "athlete_competitions", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_athlete_competitions_category_id"), "athlete_competitions", ["category_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_athlete_competitions_category_id"), table_name="athlete_competitions")
    op.drop_index(op.f("ix_athlete_competitions_tournament_id"), table_name="athlete_competitions")
    op.drop_index(op.f("ix_athlete_competitions_athlete_id"), table_name="athlete_competitions")
    op.drop_table("athlete_competitions")

    op.drop_index(op.f("ix_achievements_athlete_id"), table_name="achievements")
    op.drop_table("achievements")

    op.drop_index(op.f("ix_rating_events_source_id"), table_name="rating_events")
    op.drop_index(op.f("ix_rating_events_athlete_id"), table_name="rating_events")
    op.drop_table("rating_events")

    op.drop_index(op.f("ix_rating_profiles_athlete_id"), table_name="rating_profiles")
    op.drop_table("rating_profiles")
