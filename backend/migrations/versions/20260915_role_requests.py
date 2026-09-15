"""заявки на роли (инструктор/организатор/судья/модератор)

Заводит роли INSTRUCTOR/ORGANIZER/JUDGE/MODERATOR (USER уже создаётся лениво
в AuthService.register_user), permission role_requests.review + связь с
MODERATOR через role_permissions, таблицу role_requests и (best-effort,
no-op если такого email нет) выдаёт роль MODERATOR пользователю с email
leokibutca@gmail.com — единственный ручной bootstrap. Дальше новые
модераторы заводятся через тот же request/approve флоу. См.
docs/superpowers/specs/2026-09-15-role-requests-design.md.

downgrade() намеренно не удаляет засеянные роли/бутстрап-грант — к моменту
даунгрейда на них уже могли опираться реальные user_roles, и ondelete
CASCADE на role_requests/role_permissions при удалении ролей стёр бы их.

Revision ID: 20260915_role_requests
Revises: 20260914_email_verification
Create Date: 2026-09-15 00:00:00.000000
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260915_role_requests"
down_revision = "20260914_email_verification"
branch_labels = None
depends_on = None

ROLE_SEED = [
    ("INSTRUCTOR", "Инструктор"),
    ("ORGANIZER", "Организатор"),
    ("JUDGE", "Судья"),
    ("MODERATOR", "Модератор"),
]
REVIEW_PERMISSION_CODE = "role_requests.review"
BOOTSTRAP_MODERATOR_EMAIL = "leokibutca@gmail.com"


def upgrade() -> None:
    bind = op.get_bind()

    role_ids: dict[str, str] = {}
    for code, name in ROLE_SEED:
        row = bind.execute(sa.text("SELECT id FROM roles WHERE code = :code"), {"code": code}).fetchone()
        if row is not None:
            role_ids[code] = str(row[0])
            continue
        new_id = str(uuid.uuid4())
        role_ids[code] = new_id
        bind.execute(
            sa.text(
                "INSERT INTO roles (id, code, name, created_at, updated_at) "
                "VALUES (:id, :code, :name, now(), now())"
            ),
            {"id": new_id, "code": code, "name": name},
        )

    permission_row = bind.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"), {"code": REVIEW_PERMISSION_CODE}
    ).fetchone()
    if permission_row is not None:
        permission_id = str(permission_row[0])
    else:
        permission_id = str(uuid.uuid4())
        bind.execute(
            sa.text(
                "INSERT INTO permissions (id, code, name, description, created_at, updated_at) "
                "VALUES (:id, :code, :name, :description, now(), now())"
            ),
            {
                "id": permission_id,
                "code": REVIEW_PERMISSION_CODE,
                "name": "Review role requests",
                "description": "Approve or reject pending role requests (instructor/organizer/judge/moderator).",
            },
        )

    link_row = bind.execute(
        sa.text("SELECT id FROM role_permissions WHERE role_id = :role_id AND permission_id = :permission_id"),
        {"role_id": role_ids["MODERATOR"], "permission_id": permission_id},
    ).fetchone()
    if link_row is None:
        bind.execute(
            sa.text(
                "INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at) "
                "VALUES (:id, :role_id, :permission_id, now(), now())"
            ),
            {"id": str(uuid.uuid4()), "role_id": role_ids["MODERATOR"], "permission_id": permission_id},
        )

    op.create_table(
        "role_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_code", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("justification", sa.String(length=2000), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason_code", sa.String(length=50), nullable=True),
        sa.Column("rejection_reason_text", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_role_requests_user_id", "role_requests", ["user_id"])
    op.create_index(
        "uq_role_requests_pending_user_role",
        "role_requests",
        ["user_id", "role_code"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )

    bootstrap_user = bind.execute(
        sa.text("SELECT id FROM users WHERE email = :email"), {"email": BOOTSTRAP_MODERATOR_EMAIL}
    ).fetchone()
    if bootstrap_user is not None:
        bootstrap_user_id = str(bootstrap_user[0])
        existing_grant = bind.execute(
            sa.text("SELECT id FROM user_roles WHERE user_id = :user_id AND role_id = :role_id"),
            {"user_id": bootstrap_user_id, "role_id": role_ids["MODERATOR"]},
        ).fetchone()
        if existing_grant is None:
            bind.execute(
                sa.text(
                    "INSERT INTO user_roles (id, user_id, role_id, assigned_at, created_at, updated_at) "
                    "VALUES (:id, :user_id, :role_id, now(), now(), now())"
                ),
                {"id": str(uuid.uuid4()), "user_id": bootstrap_user_id, "role_id": role_ids["MODERATOR"]},
            )


def downgrade() -> None:
    op.drop_index("uq_role_requests_pending_user_role", table_name="role_requests")
    op.drop_index("ix_role_requests_user_id", table_name="role_requests")
    op.drop_table("role_requests")
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code = 'role_requests.review')"
        )
    )
    op.execute(sa.text("DELETE FROM permissions WHERE code = 'role_requests.review'"))
