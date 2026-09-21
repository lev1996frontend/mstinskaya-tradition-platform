"""согласие на обработку персональных данных при регистрации

users.privacy_consent_at — колонка на identity's User, тот же паттерн, что
email_verified_at (20260914_email_verification): registration происходит
внутри identity's собственного AuthService.register_user, так что это не
новое исключение из docs/clubs-domain.md rule 5, а расширение identity's
собственной регистрационной логики. Существующие пользователи получают
NULL (согласие не зафиксировано задним числом) — фронтенд/бэкенд ничего с
этим не делает, колонка только для аудита факта и времени согласия новых
регистраций.

Revision ID: 20260919_privacy_consent
Revises: 20260919_admin_role_and_cleanup
Create Date: 2026-09-19 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260919_privacy_consent"
down_revision = "20260919_admin_role_and_cleanup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("privacy_consent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "privacy_consent_at")
