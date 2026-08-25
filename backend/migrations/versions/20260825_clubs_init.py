"""Initial club tables.

Revision ID: 20260825_clubs_init
Revises: 20260825_identity_init
Create Date: 2026-08-25 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_clubs_init"
down_revision = "20260825_identity_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clubs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_clubs"),
        sa.UniqueConstraint("name", name="uq_clubs_name"),
    )
    op.create_index(op.f("ix_clubs_name"), "clubs", ["name"], unique=False)

    op.create_table(
        "club_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("club_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="MEMBER"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["club_id"], ["clubs.id"], name="fk_club_members_club_id_clubs", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_club_members_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_club_members"),
        sa.UniqueConstraint("club_id", "user_id", name="uq_club_members_club_user"),
    )
    op.create_index(op.f("ix_club_members_club_id"), "club_members", ["club_id"], unique=False)
    op.create_index(op.f("ix_club_members_user_id"), "club_members", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_club_members_user_id"), table_name="club_members")
    op.drop_index(op.f("ix_club_members_club_id"), table_name="club_members")
    op.drop_table("club_members")

    op.drop_index(op.f("ix_clubs_name"), table_name="clubs")
    op.drop_table("clubs")
