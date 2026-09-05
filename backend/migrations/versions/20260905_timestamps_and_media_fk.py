"""aware timestamps everywhere, and the foreign key media_files always meant

Two pieces of model/migration drift, both invisible to a test suite that builds
its schema from the models on SQLite and never runs these migrations at all.

**Timestamps.** Most tables were created with ``timestamptz``, but eighteen
columns across ratings, media and a few later additions were created as
``timestamp without time zone``. Every model writes
``datetime.now(timezone.utc)`` — an aware value — so in those eighteen the
offset was being dropped on the way in and the instant read back was whatever
the session's ``TimeZone`` made of it. They are converted here, reading the
stored values as UTC because that is what the application always wrote.
``Base.type_annotation_map`` now pins the Python side to
``DateTime(timezone=True)`` so the two halves cannot drift apart again.

**media_files.uploaded_by.** The model has always declared a foreign key to
``users.id``; the migration created a bare UUID, so nothing stopped a file from
naming an uploader who does not exist. The constraint is created with
``RESTRICT``: the column is ``NOT NULL``, which makes the ``SET NULL`` the
model used to ask for impossible to honour.

Revision ID: 20260905_timestamps_and_media_fk
Revises: 20260905_achievement_issued_date
Create Date: 2026-09-05 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260905_timestamps_and_media_fk"
down_revision = "20260905_achievement_issued_date"
branch_labels = None
depends_on = None


#: Every ``timestamp without time zone`` column left in the schema.
NAIVE_COLUMNS: tuple[tuple[str, str], ...] = (
    ("achievements", "created_at"),
    ("achievements", "earned_at"),
    ("achievements", "issued_date"),
    ("achievements", "updated_at"),
    ("athlete_competitions", "created_at"),
    ("athlete_competitions", "updated_at"),
    ("competition_groups", "created_at"),
    ("competition_groups", "updated_at"),
    ("content_access", "created_at"),
    ("documents", "created_at"),
    ("documents", "updated_at"),
    ("media_files", "created_at"),
    ("media_files", "updated_at"),
    ("rating_events", "created_at"),
    ("rating_profiles", "created_at"),
    ("rating_profiles", "last_calculated_at"),
    ("rating_profiles", "updated_at"),
    ("videos", "created_at"),
    ("videos", "updated_at"),
)

MEDIA_UPLOADER_FK = "fk_media_files_uploaded_by_users"


def upgrade() -> None:
    for table, column in NAIVE_COLUMNS:
        op.execute(
            f'ALTER TABLE "{table}" ALTER COLUMN "{column}" '
            f"TYPE TIMESTAMP WITH TIME ZONE USING \"{column}\" AT TIME ZONE 'UTC'"
        )

    op.create_foreign_key(
        MEDIA_UPLOADER_FK,
        "media_files",
        "users",
        ["uploaded_by"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(MEDIA_UPLOADER_FK, "media_files", type_="foreignkey")

    for table, column in NAIVE_COLUMNS:
        op.execute(
            f'ALTER TABLE "{table}" ALTER COLUMN "{column}" '
            f"TYPE TIMESTAMP WITHOUT TIME ZONE USING \"{column}\" AT TIME ZONE 'UTC'"
        )
