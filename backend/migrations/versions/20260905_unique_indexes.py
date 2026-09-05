"""one unique index where the schema had a constraint and a plain index

The last of the model/migration drift, and the least consequential: six columns
declare ``unique=True, index=True``, which SQLAlchemy renders as a single
unique index, while the migrations created a UNIQUE constraint *plus* a
separate non-unique index. Uniqueness was enforced either way, so nothing
behaved differently — but every ``alembic revision --autogenerate`` reported
the difference, and a baseline that always shows nineteen spurious diffs is a
baseline nobody reads. This brings it to zero, so the next real drift stands
out.

``media_files.storage_key`` went the other way: the schema had a UNIQUE
constraint the model never declared. That one is corrected on the model, since
a storage key that two rows can share is a bug, not a relaxation worth keeping.

Revision ID: 20260905_unique_indexes
Revises: 20260905_timestamps_and_media_fk
Create Date: 2026-09-05 00:00:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "20260905_unique_indexes"
down_revision = "20260905_timestamps_and_media_fk"
branch_labels = None
depends_on = None


#: (table, column, existing UNIQUE constraint name, index name)
UNIQUE_COLUMNS: tuple[tuple[str, str, str, str], ...] = (
    ("documents", "media_file_id", "documents_media_file_id_key", "ix_documents_media_file_id"),
    ("match_results", "match_id", "match_results_match_id_key", "ix_match_results_match_id"),
    ("profiles", "user_id", "uq_profiles_user_id", "ix_profiles_user_id"),
    (
        "rating_profiles",
        "athlete_id",
        "rating_profiles_athlete_id_key",
        "ix_rating_profiles_athlete_id",
    ),
    (
        "refresh_tokens",
        "token_hash",
        "uq_refresh_tokens_token_hash",
        "ix_refresh_tokens_token_hash",
    ),
    ("videos", "media_file_id", "videos_media_file_id_key", "ix_videos_media_file_id"),
)


def upgrade() -> None:
    for table, column, constraint, index in UNIQUE_COLUMNS:
        # The unique index is created before the constraint goes, so the column
        # is never briefly unprotected.
        op.drop_index(index, table_name=table)
        op.create_index(index, table, [column], unique=True)
        op.drop_constraint(constraint, table, type_="unique")


def downgrade() -> None:
    for table, column, constraint, index in UNIQUE_COLUMNS:
        op.create_unique_constraint(constraint, table, [column])
        op.drop_index(index, table_name=table)
        op.create_index(index, table, [column], unique=False)
