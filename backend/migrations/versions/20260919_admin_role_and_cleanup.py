"""seed ADMIN role + drop redundant roles.code index

Two unrelated, independently-safe cleanups bundled together:

1. Seeds a ``roles`` row for code ``ADMIN``. ``app/core/privileged_access.py``
   has documented ``ADMIN`` as a privileged role code since it was written
   ("an instance without it would have no way to intervene when the usual
   privileged account is unavailable"), but no migration ever created the
   ``Role`` row for it and nothing in ``role_requests`` grants it (by design —
   it is not self-service). Without the row, that break-glass intent was
   unreachable even for an operator granting it by hand via SQL, since
   ``user_roles.role_id`` has to reference an existing ``roles.id``. This
   migration only creates the role row; it grants it to nobody.
2. Drops ``ix_roles_code``. ``roles.code`` already has a unique constraint
   (``uq_roles_code``, from 20260825_identity_init), which Postgres backs
   with its own unique index — the plain index from the same migration was
   always redundant.

Revision ID: 20260919_admin_role_and_cleanup
Revises: 20260915_role_requests
Create Date: 2026-09-19 00:00:00.000000
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op

revision = "20260919_admin_role_and_cleanup"
down_revision = "20260915_role_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    row = bind.execute(sa.text("SELECT id FROM roles WHERE code = :code"), {"code": "ADMIN"}).fetchone()
    if row is None:
        bind.execute(
            sa.text(
                "INSERT INTO roles (id, code, name, created_at, updated_at) "
                "VALUES (:id, :code, :name, now(), now())"
            ),
            {"id": str(uuid.uuid4()), "code": "ADMIN", "name": "Администратор"},
        )

    op.drop_index("ix_roles_code", table_name="roles")


def downgrade() -> None:
    op.create_index("ix_roles_code", "roles", ["code"], unique=False)
    # The ADMIN role row is intentionally left in place on downgrade — a
    # real user_roles grant may already reference it (same rationale as
    # 20260915_role_requests's downgrade for its own seeded roles).
