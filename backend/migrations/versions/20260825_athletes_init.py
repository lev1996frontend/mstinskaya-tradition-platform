"""Initial athlete table.

Revision ID: 20260825_athletes_init
Revises: 20260825_clubs_init
Create Date: 2026-08-25 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_athletes_init"
down_revision = "20260825_clubs_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "athletes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nickname", sa.String(length=100), nullable=True),
        sa.Column("birth_year", sa.Integer(), nullable=True),
        sa.Column("experience_years", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="BEGINNER"),
        sa.Column("bio", sa.String(length=2000), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_athletes_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_athletes"),
        sa.UniqueConstraint("user_id", name="uq_athletes_user_id"),
    )
    op.create_index(op.f("ix_athletes_user_id"), "athletes", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_athletes_user_id"), table_name="athletes")
    op.drop_table("athletes")
