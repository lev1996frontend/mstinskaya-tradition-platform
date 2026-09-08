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


def downgrade() -> None:
    op.drop_index("ix_media_files_content_sha256", table_name="media_files")
    op.drop_column("media_files", "content_sha256")
