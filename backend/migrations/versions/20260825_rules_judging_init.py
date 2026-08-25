"""Initial rules and judging tables.

Revision ID: 20260825_rules_judging_init
Revises: 20260825_education_init
Create Date: 2026-08-25 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_rules_judging_init"
down_revision = "20260825_education_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rule_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_rule_sets"),
    )
    op.create_index(op.f("ix_rule_sets_title"), "rule_sets", ["title"], unique=False)

    op.create_table(
        "rule_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["rule_set_id"], ["rule_sets.id"], name="fk_rule_sections_rule_set_id_rule_sets", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_rule_sections"),
    )
    op.create_index(op.f("ix_rule_sections_rule_set_id"), "rule_sections", ["rule_set_id"], unique=False)

    op.create_table(
        "rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("rule_type", sa.String(length=20), nullable=False, server_default="GENERAL"),
        sa.Column("order_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["section_id"], ["rule_sections.id"], name="fk_rules_section_id_rule_sections", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_rules"),
    )
    op.create_index(op.f("ix_rules_section_id"), "rules", ["section_id"], unique=False)

    op.create_table(
        "judging_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(length=500), nullable=True),
        sa.Column("correct_decision", sa.String(length=50), nullable=False),
        sa.Column("judge_comment", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=20), nullable=False, server_default="STRIKE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_judging_scenarios"),
    )
    op.create_index(op.f("ix_judging_scenarios_title"), "judging_scenarios", ["title"], unique=False)

    op.create_table(
        "judge_certifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="LOCAL"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_judge_certifications_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_judge_certifications"),
    )
    op.create_index(op.f("ix_judge_certifications_user_id"), "judge_certifications", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_judge_certifications_user_id"), table_name="judge_certifications")
    op.drop_table("judge_certifications")

    op.drop_index(op.f("ix_judging_scenarios_title"), table_name="judging_scenarios")
    op.drop_table("judging_scenarios")

    op.drop_index(op.f("ix_rules_section_id"), table_name="rules")
    op.drop_table("rules")

    op.drop_index(op.f("ix_rule_sections_rule_set_id"), table_name="rule_sections")
    op.drop_table("rule_sections")

    op.drop_index(op.f("ix_rule_sets_title"), table_name="rule_sets")
    op.drop_table("rule_sets")
