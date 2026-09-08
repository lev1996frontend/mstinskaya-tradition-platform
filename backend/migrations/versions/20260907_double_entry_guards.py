"""дважды нажатая кнопка не заводит бойца дважды

Два средства на двух уровнях. Частичный уникальный индекс на
``(competition_id, athlete_id)`` — доменный инвариант: один профиль не может быть
заявлен в одну дисциплину дважды. По имени уникальности нет и не будет: полные
тёзки возможны, и запрещать их схемой нельзя.

Таблица ключей идемпотентности — для тех, у кого профиля нет и индекс их не
видит. Ключ занимается до работы, поэтому одновременный второй запрос упирается
в первичный ключ, а не в гонку чтения.

Индекс — единственное место здесь, способное упасть на живых данных. Если дубли
уже есть, ревизия называет их поимённо и останавливается: чинить данные молча
опаснее, чем не примениться.

Revision ID: 20260907_double_entry_guards
Revises: 20260905_participant_replacement
Create Date: 2026-09-07 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260907_double_entry_guards"
down_revision = "20260905_participant_replacement"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_participant_athlete_per_competition"
PARTIAL_WHERE = "athlete_id IS NOT NULL AND competition_id IS NOT NULL"


def upgrade() -> None:
    duplicates = op.get_bind().execute(
        sa.text(
            """
            SELECT competition_id, athlete_id, COUNT(*) AS n
            FROM tournament_participants
            WHERE athlete_id IS NOT NULL AND competition_id IS NOT NULL
            GROUP BY competition_id, athlete_id
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    if duplicates:
        listing = ", ".join(
            f"дисциплина {row.competition_id} / боец {row.athlete_id}: {row.n}"
            for row in duplicates
        )
        raise RuntimeError(
            "В базе уже есть повторно заявленные бойцы, индекс не создать. "
            f"Разберите эти пары и повторите: {listing}"
        )

    op.create_index(
        INDEX_NAME,
        "tournament_participants",
        ["competition_id", "athlete_id"],
        unique=True,
        postgresql_where=sa.text(PARTIAL_WHERE),
        sqlite_where=sa.text(PARTIAL_WHERE),
    )

    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("endpoint", sa.String(length=200), primary_key=True),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_idempotency_keys_created_at", "idempotency_keys", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_idempotency_keys_created_at", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
    op.drop_index(INDEX_NAME, table_name="tournament_participants")
