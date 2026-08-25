"""media init

Revision ID: 20260825_media_init
Revises: 20260825_ratings_init
Create Date: 2026-08-25 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_media_init"
down_revision = "20260825_ratings_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False, unique=True),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False, server_default="DOCUMENT"),
        sa.Column("size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(op.f("ix_media_files_uploaded_by"), "media_files", ["uploaded_by"], unique=False)

    op.create_table(
        "videos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("media_file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("preview_image_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("thumbnail_key", sa.String(length=500), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=1000), nullable=True),
        sa.Column("is_processed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["media_file_id"], ["media_files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["preview_image_id"], ["media_files.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("media_file_id"),
    )
    op.create_index(op.f("ix_videos_media_file_id"), "videos", ["media_file_id"], unique=False)
    op.create_index(op.f("ix_videos_preview_image_id"), "videos", ["preview_image_id"], unique=False)

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("media_file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("document_type", sa.String(length=20), nullable=False, server_default="MANUAL"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["media_file_id"], ["media_files.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("media_file_id"),
    )
    op.create_index(op.f("ix_documents_media_file_id"), "documents", ["media_file_id"], unique=False)

    op.create_table(
        "content_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("media_file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("access_level", sa.String(length=20), nullable=False, server_default="USER"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["media_file_id"], ["media_files.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_content_access_media_file_id"), "content_access", ["media_file_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_content_access_media_file_id"), table_name="content_access")
    op.drop_table("content_access")

    op.drop_index(op.f("ix_documents_media_file_id"), table_name="documents")
    op.drop_table("documents")

    op.drop_index(op.f("ix_videos_preview_image_id"), table_name="videos")
    op.drop_index(op.f("ix_videos_media_file_id"), table_name="videos")
    op.drop_table("videos")

    op.drop_index(op.f("ix_media_files_uploaded_by"), table_name="media_files")
    op.drop_table("media_files")
