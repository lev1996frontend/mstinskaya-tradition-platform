"""файлы наконец есть где хранить

Колонка хеша на media_files — чтобы те же байты, присланные дважды, не
удваивались: одна строка, один объект на диске, вторая ссылка. Nullable,
потому что строки, заведённые до появления хранилища, хеша не имеют и
задним числом его взять неоткуда — файлов у них нет.

Revision ID: 20260908_file_storage
Revises: 20260907_double_entry_guards
Create Date: 2026-09-08 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260908_file_storage"
down_revision = "20260907_double_entry_guards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_files", sa.Column("content_sha256", sa.String(length=64), nullable=True))
    op.create_index("ix_media_files_content_sha256", "media_files", ["content_sha256"])
    op.add_column(
        "tournament_documents",
        sa.Column("media_file_id", sa.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tournament_documents_media_file_id",
        "tournament_documents",
        "media_files",
        ["media_file_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_tournament_documents_media_file_id", "tournament_documents", ["media_file_id"]
    )
    op.add_column(
        "tournament_documents",
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # An edition of the rules can carry the Word file it was published as.
    # A table rather than a column on rule_sets: editions are historical and
    # never rewritten, so the 1.0 file must survive the arrival of 2.0.
    op.create_table(
        "rule_set_documents",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "rule_set_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("rule_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "media_file_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rule_set_documents_rule_set_id", "rule_set_documents", ["rule_set_id"])
    op.create_index("ix_rule_set_documents_media_file_id", "rule_set_documents", ["media_file_id"])


def downgrade() -> None:
    op.drop_index("ix_rule_set_documents_media_file_id", table_name="rule_set_documents")
    op.drop_index("ix_rule_set_documents_rule_set_id", table_name="rule_set_documents")
    op.drop_table("rule_set_documents")

    op.drop_column("tournament_documents", "removed_at")
    op.drop_index("ix_tournament_documents_media_file_id", table_name="tournament_documents")
    op.drop_constraint(
        "fk_tournament_documents_media_file_id", "tournament_documents", type_="foreignkey"
    )
    op.drop_column("tournament_documents", "media_file_id")
    op.drop_index("ix_media_files_content_sha256", table_name="media_files")
    op.drop_column("media_files", "content_sha256")
