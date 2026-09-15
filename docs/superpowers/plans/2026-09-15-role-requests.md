# Role Requests (instructor/organizer/judge/moderator approval) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user request `INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR` and have a `MODERATOR` review (approve/reject with a reason) — backend only, no admin app, reusing the existing (currently unused) `Role`/`Permission`/`RolePermission` tables.

**Architecture:** New domain module `app/modules/role_requests/` owns a `role_requests` table (append-only decisions, one `PENDING` request per `(user, role)`). Approving a request must write to identity's `user_roles` table, which `role_requests` cannot do directly (`docs/clubs-domain.md` rule 5) — this plan adds a second, documented write exception (after `email_verified_at`): `AuthService.assign_role` in `identity`, exposed read-write via `app/core/identity_access.py`. Emails reuse the existing `EmailService`/Resend wrapper (`app/core/email.py`).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async ORM, Alembic, Pydantic v2, `pytest` + `fastapi.testclient.TestClient` against in-memory `sqlite+aiosqlite` (per `CLAUDE.md`, no Postgres/Docker needed for tests).

**Spec:** `docs/superpowers/specs/2026-09-15-role-requests-design.md`

## Global Constraints

- Requestable roles are exactly `INSTRUCTOR`, `ORGANIZER`, `JUDGE`, `MODERATOR` — never `USER` (auto-granted at registration).
- At most one `PENDING` request per `(user_id, role_code)` at a time; different roles may have parallel pending requests.
- A resolved (`APPROVED`/`REJECTED`) request is never mutated — reapplying after rejection creates a **new** row.
- Rejections require `reason_code` from `INSUFFICIENT_EVIDENCE`/`NOT_RECOGNIZED`/`DUPLICATE_REQUEST`/`OTHER`; `reason_text` is required only when `reason_code == "OTHER"`.
- One combined `PATCH /api/v1/role-requests/{id}` handles both approve and reject (no separate `/approve`/`/reject` endpoints).
- `MODERATOR` is bootstrapped exactly once, by data migration, for the user with email `leokibutca@gmail.com`; every subsequent `MODERATOR` grant goes through the same request/approve flow.
- Email sending never fails the primary action — always `try`/`except Exception: logger.exception(...)` around the send, same pattern as `app/modules/auth/router.py`'s verification email.
- `docs/clubs-domain.md` rule 5 and `CLAUDE.md`'s identity section must name this as the second deliberate write exception (after `email_verified_at`), not a silent one.
- Frontend is explicitly out of scope for this plan (see spec's "Не входит в эту задачу" / the design conversation) — backend only.

---

### Task 1: Migration — roles/permission seed, `role_requests` table, moderator bootstrap

**Files:**
- Create: `backend/migrations/versions/20260915_role_requests.py`

**Interfaces:**
- Produces: table `role_requests` with columns `id, user_id, role_code, status, justification, reviewed_by, reviewed_at, rejection_reason_code, rejection_reason_text, created_at, updated_at`, a partial unique index `uq_role_requests_pending_user_role` on `(user_id, role_code)` where `status = 'PENDING'`; roles `INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR` in `roles`; permission `role_requests.review` linked to `MODERATOR` in `role_permissions`.

This migration only runs against real Postgres (the test suite uses `Base.metadata.create_all` on sqlite, per `CLAUDE.md` — Task 4 recreates the equivalent DDL from the SQLAlchemy model for that path). There is no automated test for the migration itself here; verify it against real Postgres later using the existing workflow (see memory `postgres-migration-verification` / ask the user before running it against a real database).

- [ ] **Step 1: Write the migration**

```python
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
```

- [ ] **Step 2: Verify the migration file is syntactically valid and chains onto the right head**

Run (from `backend/`):
```bash
python -c "
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'migrations/versions/20260915_role_requests.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.revision, mod.down_revision)
"
```
Expected: prints `20260915_role_requests 20260914_email_verification` with no traceback.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/versions/20260915_role_requests.py
git commit -m "feat(backend): migration for role_requests table + role/permission seed"
```

---

### Task 2: Identity role-assignment + moderator-lookup helpers

**Files:**
- Modify: `backend/app/modules/identity/services/auth_service.py`
- Modify: `backend/app/core/identity_access.py`
- Test: `backend/tests/test_role_assignment.py`

**Interfaces:**
- Produces: `AuthService.assign_role(session: AsyncSession, user_id: UUID, role_code: str) -> None` (identity's own service, does the actual `UserRole` write, idempotent, raises `HTTPException(500)` if `role_code` has no matching `Role` row).
- Produces: `identity_access.assign_role(session, user_id, role_code) -> None` (thin delegate to the above — the second documented write exception to `docs/clubs-domain.md` rule 5).
- Produces: `identity_access.get_emails_with_role_code(session, role_code: str) -> list[str]`.
- Consumes: `app.modules.identity.models.Role`, `UserRole`, `User` (already imported in both files).

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_role_assignment.py
import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.identity_access import assign_role as identity_assign_role
from app.core.identity_access import get_emails_with_role_code
from app.models.base import Base
from app.modules.identity.models import Role, User, UserRole
from app.modules.identity.services.auth_service import AuthService


def _make_sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    async def setup_db():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def _make_user(email: str) -> User:
    return User(email=email, password_hash="x", first_name="A", last_name="B", status="active")


def test_assign_role_creates_user_role_and_is_idempotent():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("mod@example.com")
            session.add(user)
            session.add(Role(code="MODERATOR", name="Moderator"))
            await session.flush()

            await AuthService.assign_role(session, user.id, "MODERATOR")
            await AuthService.assign_role(session, user.id, "MODERATOR")
            await session.commit()

            count = await session.scalar(
                select(func.count()).select_from(UserRole).where(UserRole.user_id == user.id)
            )
            assert count == 1

    asyncio.run(scenario())


def test_assign_role_raises_500_for_unconfigured_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("norole@example.com")
            session.add(user)
            await session.flush()

            with pytest.raises(HTTPException) as exc_info:
                await AuthService.assign_role(session, user.id, "GHOST")
            assert exc_info.value.status_code == 500

    asyncio.run(scenario())


def test_identity_access_assign_role_delegates_to_auth_service():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("judge@example.com")
            session.add(user)
            session.add(Role(code="JUDGE", name="Judge"))
            await session.flush()

            await identity_assign_role(session, user.id, "JUDGE")
            await session.commit()

            role_row = await session.scalar(select(Role).where(Role.code == "JUDGE"))
            link = await session.scalar(
                select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role_row.id)
            )
            assert link is not None

    asyncio.run(scenario())


def test_get_emails_with_role_code_returns_only_matching_users():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            moderator = _make_user("moderator@example.com")
            plain = _make_user("plain@example.com")
            session.add_all([moderator, plain])
            role = Role(code="MODERATOR", name="Moderator")
            session.add(role)
            await session.flush()
            session.add(UserRole(user_id=moderator.id, role_id=role.id))
            await session.commit()

            emails = await get_emails_with_role_code(session, "MODERATOR")
            assert emails == ["moderator@example.com"]

    asyncio.run(scenario())
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_role_assignment.py -v`
Expected: FAIL — `assign_role`/`get_emails_with_role_code` don't exist yet (`ImportError`/`AttributeError`).

- [ ] **Step 3: Add `AuthService.assign_role` in `app/modules/identity/services/auth_service.py`**

Add this method to the `AuthService` class (after `get_default_role`):

```python
    @staticmethod
    async def assign_role(session: AsyncSession, user_id: UUID, role_code: str) -> None:
        """Idempotent: a no-op if the user already holds `role_code`. Raises
        500 if `role_code` has no matching `Role` row — roles are a fixed
        set seeded by migration
        (`backend/migrations/versions/20260915_role_requests.py`), never
        created on the fly here."""
        role = await session.scalar(select(Role).where(Role.code == role_code))
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Role {role_code!r} is not configured",
            )
        existing = await session.scalar(
            select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role.id)
        )
        if existing is not None:
            return
        session.add(UserRole(user_id=user_id, role_id=role.id))
        await session.flush()
```

Add `from uuid import UUID` is already imported at the top of the file; confirm the file's existing imports (`Profile, Role, User, UserRole` from `app.modules.identity.models`, `HTTPException, status` from `fastapi`, `select` from `sqlalchemy`) already cover everything this method needs — no new imports required.

- [ ] **Step 4: Add the write/read helpers to `app/core/identity_access.py`**

Update the module docstring's second paragraph (the one starting "One deliberate exception") to:

```python
"""One deliberate exception: ``auth``'s ``AuthService.verify_email`` takes the
``User`` handed back by ``get_user`` and sets ``email_verified_at`` on it
directly, added for email verification at registration — see
``docs/superpowers/specs/2026-09-14-email-verification-design.md``.

A second, equally deliberate exception: ``assign_role`` below is a write —
granting a role means creating a ``UserRole`` row, which only identity's own
``AuthService.assign_role`` may do. This module exposes it because
``role_requests`` (approving a role request) needs to trigger it without
importing ``app.modules.identity.models`` itself. See
``docs/superpowers/specs/2026-09-15-role-requests-design.md``.
"""
```

Add the import and the two functions:

```python
from app.modules.identity.services.auth_service import AuthService as _IdentityAuthService
```
(place alongside the existing `from app.modules.identity.models import ...` import)

```python
async def assign_role(session: AsyncSession, user_id: UUID, role_code: str) -> None:
    await _IdentityAuthService.assign_role(session, user_id, role_code)


async def get_emails_with_role_code(session: AsyncSession, role_code: str) -> list[str]:
    emails = await session.scalars(
        select(User.email)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.code == role_code)
    )
    return list(emails)
```

Add `"assign_role"` and `"get_emails_with_role_code"` to the module's `__all__` list.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/test_role_assignment.py -v`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/identity/services/auth_service.py backend/app/core/identity_access.py backend/tests/test_role_assignment.py
git commit -m "feat(backend): identity role-assignment + moderator-email-lookup helpers"
```

---

### Task 3: `EmailService` role-request notifications

**Files:**
- Modify: `backend/app/core/email.py`
- Test: `backend/tests/test_role_request_emails.py`

**Interfaces:**
- Produces: `EmailService.send_role_request_submitted(*, to: str, role_code: str, applicant_name: str, settings: Settings | None = None) -> None`
- Produces: `EmailService.send_role_request_approved(*, to: str, role_code: str, settings: Settings | None = None) -> None`
- Produces: `EmailService.send_role_request_rejected(*, to: str, role_code: str, reason_code: str, reason_text: str | None, settings: Settings | None = None) -> None`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_role_request_emails.py
from app.core.config import Settings
from app.core.email import EmailService


def _dev_settings() -> Settings:
    return Settings(resend_api_key=None)


def test_send_role_request_submitted_logs_without_raising(caplog):
    with caplog.at_level("INFO"):
        EmailService.send_role_request_submitted(
            to="mod@example.com", role_code="INSTRUCTOR", applicant_name="Иван Иванов", settings=_dev_settings()
        )
    assert "Иван Иванов" in caplog.text
    assert "Инструктор" in caplog.text


def test_send_role_request_approved_logs_role_label(caplog):
    with caplog.at_level("INFO"):
        EmailService.send_role_request_approved(to="user@example.com", role_code="JUDGE", settings=_dev_settings())
    assert "Судья" in caplog.text


def test_send_role_request_rejected_uses_fixed_label_for_known_reason(caplog):
    with caplog.at_level("INFO"):
        EmailService.send_role_request_rejected(
            to="user@example.com",
            role_code="ORGANIZER",
            reason_code="INSUFFICIENT_EVIDENCE",
            reason_text=None,
            settings=_dev_settings(),
        )
    assert "недостаточно подтверждений" in caplog.text


def test_send_role_request_rejected_uses_free_text_for_other():
    # OTHER without a network call still must not raise even though the
    # caller-supplied text, not a fixed label, drives the message.
    EmailService.send_role_request_rejected(
        to="user@example.com",
        role_code="ORGANIZER",
        reason_code="OTHER",
        reason_text="нет подтверждающих документов от клуба",
        settings=_dev_settings(),
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_role_request_emails.py -v`
Expected: FAIL — the three methods don't exist yet (`AttributeError`).

- [ ] **Step 3: Add the methods to `app/core/email.py`**

Add near the top of the file, after the `logger = logging.getLogger(__name__)` line:

```python
_ROLE_LABELS: dict[str, str] = {
    "INSTRUCTOR": "Инструктор",
    "ORGANIZER": "Организатор",
    "JUDGE": "Судья",
    "MODERATOR": "Модератор",
}
_REJECTION_REASON_LABELS: dict[str, str] = {
    "INSUFFICIENT_EVIDENCE": "недостаточно подтверждений",
    "NOT_RECOGNIZED": "не удалось верифицировать данные",
    "DUPLICATE_REQUEST": "дублирующая заявка",
}
```

Add these three static methods to the `EmailService` class (after `send_verification_email`):

```python
    @staticmethod
    def send_role_request_submitted(
        *, to: str, role_code: str, applicant_name: str, settings: Settings | None = None
    ) -> None:
        settings = settings or get_settings()
        role_label = _ROLE_LABELS.get(role_code, role_code)
        subject = f"Новая заявка на роль «{role_label}» — Мстинская традиция"
        html = (
            f"<p>{applicant_name} подал(а) заявку на роль «{role_label}».</p>"
            f"<p>Рассмотреть можно на странице модерации заявок.</p>"
        )
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r body=%r", to, subject, html)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})

    @staticmethod
    def send_role_request_approved(*, to: str, role_code: str, settings: Settings | None = None) -> None:
        settings = settings or get_settings()
        role_label = _ROLE_LABELS.get(role_code, role_code)
        subject = f"Заявка на роль «{role_label}» одобрена — Мстинская традиция"
        html = f"<p>Ваша заявка на роль «{role_label}» одобрена.</p>"
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r body=%r", to, subject, html)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})

    @staticmethod
    def send_role_request_rejected(
        *, to: str, role_code: str, reason_code: str, reason_text: str | None, settings: Settings | None = None
    ) -> None:
        settings = settings or get_settings()
        role_label = _ROLE_LABELS.get(role_code, role_code)
        reason = reason_text if reason_code == "OTHER" else _REJECTION_REASON_LABELS.get(reason_code, reason_code)
        subject = f"Заявка на роль «{role_label}» отклонена — Мстинская традиция"
        html = f"<p>Ваша заявка на роль «{role_label}» отклонена.</p><p>Причина: {reason}</p>"
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r body=%r", to, subject, html)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_role_request_emails.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/email.py backend/tests/test_role_request_emails.py
git commit -m "feat(backend): role-request notification emails"
```

---

### Task 4: `RoleRequest` model + Pydantic schemas

**Files:**
- Create: `backend/app/modules/role_requests/__init__.py`
- Create: `backend/app/modules/role_requests/models/__init__.py`
- Create: `backend/app/modules/role_requests/models/role_request.py`
- Create: `backend/app/modules/role_requests/schemas/__init__.py`
- Create: `backend/app/modules/role_requests/schemas/role_request.py`
- Test: `backend/tests/test_role_request_model.py`
- Test: `backend/tests/test_role_request_schema.py`

**Interfaces:**
- Produces: `RoleRequest` ORM model (`app.modules.role_requests.models.role_request`), constants `ROLE_CODES: tuple[str, ...]` and `REJECTION_REASON_CODES: tuple[str, ...]`.
- Produces: `RoleRequestCreateRequest(role_code, justification)`, `RoleRequestReviewRequest(status, reason_code, reason_text)` (with cross-field validation), `RoleRequestResponse(...)` in `app.modules.role_requests.schemas.role_request`.

- [ ] **Step 1: Write the failing model test**

```python
# backend/tests/test_role_request_model.py
import asyncio

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base
from app.modules.identity.models import User
from app.modules.role_requests.models.role_request import RoleRequest


def _make_sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    async def setup_db():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def test_two_pending_requests_same_user_and_role_violate_unique_index():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = User(email="dup@example.com", password_hash="x", first_name="A", last_name="B", status="active")
            session.add(user)
            await session.flush()
            session.add(RoleRequest(user_id=user.id, role_code="INSTRUCTOR", status="PENDING", justification="a"))
            await session.flush()
            session.add(RoleRequest(user_id=user.id, role_code="INSTRUCTOR", status="PENDING", justification="b"))
            try:
                await session.flush()
                raised = False
            except IntegrityError:
                raised = True
            assert raised

    asyncio.run(scenario())


def test_pending_after_rejected_same_user_and_role_is_allowed():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = User(email="retry@example.com", password_hash="x", first_name="A", last_name="B", status="active")
            session.add(user)
            await session.flush()
            session.add(RoleRequest(user_id=user.id, role_code="JUDGE", status="REJECTED", justification="a"))
            await session.flush()
            session.add(RoleRequest(user_id=user.id, role_code="JUDGE", status="PENDING", justification="b"))
            await session.flush()  # must not raise

    asyncio.run(scenario())
```

- [ ] **Step 2: Write the failing schema test**

```python
# backend/tests/test_role_request_schema.py
import pytest
from pydantic import ValidationError

from app.modules.role_requests.schemas.role_request import RoleRequestReviewRequest


def test_reject_without_reason_code_is_invalid():
    with pytest.raises(ValidationError):
        RoleRequestReviewRequest(status="REJECTED")


def test_reject_with_other_and_no_text_is_invalid():
    with pytest.raises(ValidationError):
        RoleRequestReviewRequest(status="REJECTED", reason_code="OTHER")


def test_reject_with_other_and_text_is_valid():
    payload = RoleRequestReviewRequest(status="REJECTED", reason_code="OTHER", reason_text="нет документов")
    assert payload.reason_text == "нет документов"


def test_reject_with_fixed_reason_code_is_valid():
    payload = RoleRequestReviewRequest(status="REJECTED", reason_code="INSUFFICIENT_EVIDENCE")
    assert payload.reason_text is None


def test_approve_ignores_reason_fields():
    payload = RoleRequestReviewRequest(status="APPROVED")
    assert payload.reason_code is None
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest backend/tests/test_role_request_model.py backend/tests/test_role_request_schema.py -v`
Expected: FAIL — `app.modules.role_requests` doesn't exist yet (`ModuleNotFoundError`).

- [ ] **Step 4: Create the module skeleton and model**

`backend/app/modules/role_requests/__init__.py`:
```python
```
(empty — matches `app/modules/clubs/__init__.py`'s style: a package marker only)

`backend/app/modules/role_requests/models/__init__.py`:
```python
from .role_request import RoleRequest

__all__ = ["RoleRequest"]
```

`backend/app/modules/role_requests/models/role_request.py`:
```python
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

#: Requestable roles. `USER` is excluded — it is granted automatically at
#: registration (`AuthService.register_user`), never requested.
ROLE_CODES = ("INSTRUCTOR", "ORGANIZER", "JUDGE", "MODERATOR")
REJECTION_REASON_CODES = ("INSUFFICIENT_EVIDENCE", "NOT_RECOGNIZED", "DUPLICATE_REQUEST", "OTHER")


class RoleRequest(Base):
    __tablename__ = "role_requests"
    __table_args__ = (
        #: At most one PENDING request per (user, role); a resolved request
        #: never blocks a fresh one — see
        #: docs/superpowers/specs/2026-09-15-role-requests-design.md.
        #: `sqlite_where` mirrors `postgresql_where` so the constraint also
        #: holds under the sqlite-backed test suite (CLAUDE.md's test setup),
        #: not just against real Postgres.
        Index(
            "uq_role_requests_pending_user_role",
            "user_id",
            "role_code",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
            sqlite_where=text("status = 'PENDING'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_code: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    justification: Mapped[str] = mapped_column(String(2000), nullable=False)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rejection_reason_text: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"RoleRequest(id={self.id!r}, user_id={self.user_id!r}, role_code={self.role_code!r}, status={self.status!r})"
```

- [ ] **Step 5: Create the schemas**

`backend/app/modules/role_requests/schemas/__init__.py`:
```python
from .role_request import RoleRequestCreateRequest, RoleRequestResponse, RoleRequestReviewRequest

__all__ = ["RoleRequestCreateRequest", "RoleRequestReviewRequest", "RoleRequestResponse"]
```

`backend/app/modules/role_requests/schemas/role_request.py`:
```python
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

RoleCode = Literal["INSTRUCTOR", "ORGANIZER", "JUDGE", "MODERATOR"]
RejectionReasonCode = Literal["INSUFFICIENT_EVIDENCE", "NOT_RECOGNIZED", "DUPLICATE_REQUEST", "OTHER"]


class RoleRequestCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    role_code: RoleCode
    justification: str = Field(..., min_length=1, max_length=2000)


class RoleRequestReviewRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    status: Literal["APPROVED", "REJECTED"]
    reason_code: RejectionReasonCode | None = None
    reason_text: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _validate_rejection_reason(self) -> "RoleRequestReviewRequest":
        if self.status == "REJECTED":
            if self.reason_code is None:
                raise ValueError("reason_code is required when rejecting a role request")
            if self.reason_code == "OTHER" and not self.reason_text:
                raise ValueError("reason_text is required when reason_code is OTHER")
        return self


class RoleRequestResponse(BaseModel):
    id: str
    user_id: str
    applicant_email: str
    applicant_name: str
    role_code: str
    status: str
    justification: str
    reviewed_by: str | None
    reviewed_at: datetime | None
    rejection_reason_code: str | None
    rejection_reason_text: str | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest backend/tests/test_role_request_model.py backend/tests/test_role_request_schema.py -v`
Expected: PASS (2 + 5 passed).

- [ ] **Step 7: Commit**

```bash
git add backend/app/modules/role_requests backend/tests/test_role_request_model.py backend/tests/test_role_request_schema.py
git commit -m "feat(backend): RoleRequest model and request/response schemas"
```

---

### Task 5: `RoleRequestService`

**Files:**
- Create: `backend/app/modules/role_requests/services/__init__.py`
- Create: `backend/app/modules/role_requests/services/role_request_service.py`
- Test: `backend/tests/test_role_request_service.py`

**Interfaces:**
- Consumes: `RoleRequest`, `ROLE_CODES`, `REJECTION_REASON_CODES` (Task 4); `identity_access.get_role_codes`, `identity_access.assign_role` (Task 2).
- Produces: `RoleRequestService.create_request(session, *, user, role_code, justification) -> RoleRequest`; `RoleRequestService.list_for_user(session, user_id) -> list[RoleRequest]`; `RoleRequestService.list_for_review(session, *, status_filter: str | None) -> list[RoleRequest]`; `RoleRequestService.review(session, *, request_id: str, reviewer, decision: str, reason_code: str | None, reason_text: str | None) -> RoleRequest`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_role_request_service.py
import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base
from app.modules.identity.models import Role, User, UserRole
from app.modules.role_requests.services.role_request_service import RoleRequestService


def _make_sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    async def setup_db():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def _make_user(email: str) -> User:
    return User(email=email, password_hash="x", first_name="A", last_name="B", status="active")


def test_create_request_rejects_unknown_role_code():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("u1@example.com")
            session.add(user)
            await session.flush()
            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.create_request(session, user=user, role_code="GHOST", justification="x")
            assert exc_info.value.status_code == 400

    asyncio.run(scenario())


def test_create_request_rejects_if_user_already_has_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("u2@example.com")
            session.add(user)
            role = Role(code="INSTRUCTOR", name="Instructor")
            session.add(role)
            await session.flush()
            session.add(UserRole(user_id=user.id, role_id=role.id))
            await session.flush()

            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.create_request(
                    session, user=user, role_code="INSTRUCTOR", justification="x"
                )
            assert exc_info.value.status_code == 400

    asyncio.run(scenario())


def test_create_request_rejects_duplicate_pending():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("u3@example.com")
            session.add(user)
            await session.flush()
            await RoleRequestService.create_request(session, user=user, role_code="JUDGE", justification="first")

            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.create_request(
                    session, user=user, role_code="JUDGE", justification="second"
                )
            assert exc_info.value.status_code == 400

    asyncio.run(scenario())


def test_review_approve_grants_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant@example.com")
            reviewer = _make_user("reviewer@example.com")
            session.add_all([applicant, reviewer])
            session.add(Role(code="ORGANIZER", name="Organizer"))
            await session.flush()

            request_row = await RoleRequestService.create_request(
                session, user=applicant, role_code="ORGANIZER", justification="x"
            )
            await session.commit()

            reviewed = await RoleRequestService.review(
                session,
                request_id=str(request_row.id),
                reviewer=reviewer,
                decision="APPROVED",
                reason_code=None,
                reason_text=None,
            )
            await session.commit()

            assert reviewed.status == "APPROVED"
            assert reviewed.reviewed_by == reviewer.id

            from app.core.identity_access import get_role_codes

            codes = await get_role_codes(session, applicant.id)
            assert "ORGANIZER" in codes

    asyncio.run(scenario())


def test_review_reject_stores_reason_and_does_not_grant_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant2@example.com")
            reviewer = _make_user("reviewer2@example.com")
            session.add_all([applicant, reviewer])
            await session.flush()

            request_row = await RoleRequestService.create_request(
                session, user=applicant, role_code="JUDGE", justification="x"
            )
            await session.commit()

            reviewed = await RoleRequestService.review(
                session,
                request_id=str(request_row.id),
                reviewer=reviewer,
                decision="REJECTED",
                reason_code="INSUFFICIENT_EVIDENCE",
                reason_text=None,
            )
            await session.commit()

            assert reviewed.status == "REJECTED"
            assert reviewed.rejection_reason_code == "INSUFFICIENT_EVIDENCE"

            from app.core.identity_access import get_role_codes

            codes = await get_role_codes(session, applicant.id)
            assert "JUDGE" not in codes

    asyncio.run(scenario())


def test_review_already_resolved_request_raises_409():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant3@example.com")
            reviewer = _make_user("reviewer3@example.com")
            session.add_all([applicant, reviewer])
            session.add(Role(code="JUDGE", name="Judge"))
            await session.flush()

            request_row = await RoleRequestService.create_request(
                session, user=applicant, role_code="JUDGE", justification="x"
            )
            await session.commit()

            await RoleRequestService.review(
                session,
                request_id=str(request_row.id),
                reviewer=reviewer,
                decision="APPROVED",
                reason_code=None,
                reason_text=None,
            )
            await session.commit()

            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.review(
                    session,
                    request_id=str(request_row.id),
                    reviewer=reviewer,
                    decision="APPROVED",
                    reason_code=None,
                    reason_text=None,
                )
            assert exc_info.value.status_code == 409

    asyncio.run(scenario())


def test_reapply_after_rejection_is_allowed():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant4@example.com")
            reviewer = _make_user("reviewer4@example.com")
            session.add_all([applicant, reviewer])
            await session.flush()

            first = await RoleRequestService.create_request(
                session, user=applicant, role_code="INSTRUCTOR", justification="x"
            )
            await session.commit()
            await RoleRequestService.review(
                session,
                request_id=str(first.id),
                reviewer=reviewer,
                decision="REJECTED",
                reason_code="NOT_RECOGNIZED",
                reason_text=None,
            )
            await session.commit()

            second = await RoleRequestService.create_request(
                session, user=applicant, role_code="INSTRUCTOR", justification="y"
            )
            await session.commit()
            assert second.id != first.id

    asyncio.run(scenario())
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_role_request_service.py -v`
Expected: FAIL — `RoleRequestService` doesn't exist yet.

- [ ] **Step 3: Write the service**

`backend/app/modules/role_requests/services/__init__.py`:
```python
from .role_request_service import RoleRequestService

__all__ = ["RoleRequestService"]
```

`backend/app/modules/role_requests/services/role_request_service.py`:
```python
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identity_access import User, assign_role, get_role_codes
from app.modules.role_requests.models.role_request import REJECTION_REASON_CODES, ROLE_CODES, RoleRequest


class RoleRequestService:
    @staticmethod
    async def create_request(
        session: AsyncSession, *, user: User, role_code: str, justification: str
    ) -> RoleRequest:
        if role_code not in ROLE_CODES:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=f"Unknown role code: {role_code}")

        existing_role_codes = await get_role_codes(session, user.id)
        if role_code in existing_role_codes:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="User already has this role")

        pending = await session.scalar(
            select(RoleRequest).where(
                RoleRequest.user_id == user.id,
                RoleRequest.role_code == role_code,
                RoleRequest.status == "PENDING",
            )
        )
        if pending is not None:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="A pending request for this role already exists",
            )

        request_row = RoleRequest(user_id=user.id, role_code=role_code, status="PENDING", justification=justification)
        session.add(request_row)
        await session.flush()
        return request_row

    @staticmethod
    async def list_for_user(session: AsyncSession, user_id: UUID) -> list[RoleRequest]:
        rows = await session.scalars(
            select(RoleRequest).where(RoleRequest.user_id == user_id).order_by(RoleRequest.created_at.desc())
        )
        return list(rows)

    @staticmethod
    async def list_for_review(session: AsyncSession, *, status_filter: str | None) -> list[RoleRequest]:
        query = select(RoleRequest).order_by(RoleRequest.created_at.desc())
        if status_filter is not None:
            query = query.where(RoleRequest.status == status_filter)
        rows = await session.scalars(query)
        return list(rows)

    @staticmethod
    async def review(
        session: AsyncSession,
        *,
        request_id: str,
        reviewer: User,
        decision: str,
        reason_code: str | None,
        reason_text: str | None,
    ) -> RoleRequest:
        try:
            request_uuid = UUID(request_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found") from None

        request_row = await session.get(RoleRequest, request_uuid)
        if request_row is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found")
        if request_row.status != "PENDING":
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="Role request already resolved")

        if decision == "REJECTED":
            # Cross-field validity (reason_code required, reason_text
            # required for OTHER) is already enforced by
            # RoleRequestReviewRequest before this is called; this guard is
            # defense-in-depth for any other caller of this service.
            if reason_code not in REJECTION_REASON_CODES:
                raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid reason_code")
            request_row.status = "REJECTED"
            request_row.rejection_reason_code = reason_code
            request_row.rejection_reason_text = reason_text if reason_code == "OTHER" else None
        else:
            request_row.status = "APPROVED"
            await assign_role(session, request_row.user_id, request_row.role_code)

        request_row.reviewed_by = reviewer.id
        request_row.reviewed_at = datetime.now(timezone.utc)
        await session.flush()
        return request_row
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_role_request_service.py -v`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/role_requests/services backend/tests/test_role_request_service.py
git commit -m "feat(backend): RoleRequestService create/list/review"
```

---

### Task 6: Router, `main.py` wiring, and full API tests

**Files:**
- Create: `backend/app/modules/role_requests/routers/__init__.py`
- Create: `backend/app/modules/role_requests/routers/role_requests.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_role_requests_api.py`

**Interfaces:**
- Consumes: `RoleRequestService` (Task 5), `RoleRequestCreateRequest`/`RoleRequestReviewRequest`/`RoleRequestResponse` (Task 4), `EmailService.send_role_request_*` (Task 3), `identity_access.get_emails_with_role_code`/`get_user_or_404`/`get_users_by_ids`/`has_permission` (Task 2 + existing), `session_auth.get_current_user`.
- Produces: `router` (`APIRouter`, `prefix="/api/v1/role-requests"`) with `POST ""`, `GET "/me"`, `GET ""`, `PATCH "/{request_id}"`.

- [ ] **Step 1: Write the failing API tests**

```python
# backend/tests/test_role_requests_api.py
import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.core import email as email_module
from app.main import app
from app.models.base import Base
from app.modules.identity.models import Permission, Role, RolePermission, User, UserRole
from tests.auth_test_helpers import snapshot_session, use_session


def setup_client(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())

    async def database_session():
        async with database_module.AsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[database_module.get_db] = database_session

    submitted: list[dict] = []
    approved: list[dict] = []
    rejected: list[dict] = []
    monkeypatch.setattr(
        email_module.EmailService,
        "send_role_request_submitted",
        staticmethod(lambda **kwargs: submitted.append(kwargs)),
    )
    monkeypatch.setattr(
        email_module.EmailService,
        "send_role_request_approved",
        staticmethod(lambda **kwargs: approved.append(kwargs)),
    )
    monkeypatch.setattr(
        email_module.EmailService,
        "send_role_request_rejected",
        staticmethod(lambda **kwargs: rejected.append(kwargs)),
    )

    return TestClient(app), {"submitted": submitted, "approved": approved, "rejected": rejected}


def _register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Т", "last_name": "Т"},
    )
    assert response.status_code == 201, response.text


def _grant_moderator(email: str) -> None:
    async def scenario():
        async with database_module.AsyncSessionLocal() as session:
            user = await session.scalar(select(User).where(User.email == email))
            role = await session.scalar(select(Role).where(Role.code == "MODERATOR"))
            if role is None:
                role = Role(code="MODERATOR", name="Moderator")
                session.add(role)
                await session.flush()
            permission = await session.scalar(select(Permission).where(Permission.code == "role_requests.review"))
            if permission is None:
                permission = Permission(code="role_requests.review", name="Review role requests")
                session.add(permission)
                await session.flush()
            link = await session.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == role.id, RolePermission.permission_id == permission.id
                )
            )
            if link is None:
                session.add(RolePermission(role_id=role.id, permission_id=permission.id))
            existing = await session.scalar(
                select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id)
            )
            if existing is None:
                session.add(UserRole(user_id=user.id, role_id=role.id))
            await session.commit()

    asyncio.run(scenario())


def test_create_request_sends_email_to_moderators(monkeypatch):
    client, mail = setup_client(monkeypatch)
    _register(client, "mod@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod@example.com")

    _register(client, "applicant@example.com")
    response = client.post(
        "/api/v1/role-requests", json={"role_code": "INSTRUCTOR", "justification": "тренирую 2 года"}
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "PENDING"
    assert response.json()["applicant_email"] == "applicant@example.com"
    assert len(mail["submitted"]) == 1
    assert mail["submitted"][0]["to"] == "mod@example.com"
    app.dependency_overrides.clear()


def test_create_request_unknown_role_is_422(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "applicant2@example.com")
    response = client.post("/api/v1/role-requests", json={"role_code": "GHOST", "justification": "x"})
    assert response.status_code == 422, response.text
    app.dependency_overrides.clear()


def test_create_request_duplicate_pending_is_400(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "applicant3@example.com")
    first = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "x"})
    assert first.status_code == 201, first.text
    second = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "y"})
    assert second.status_code == 400, second.text
    app.dependency_overrides.clear()


def test_get_me_returns_only_own_requests(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "user_a@example.com")
    user_a_session = snapshot_session(client)
    client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "a"})

    _register(client, "user_b@example.com")
    client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "b"})

    use_session(client, user_a_session)
    response = client.get("/api/v1/role-requests/me")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["applicant_email"] == "user_a@example.com"
    app.dependency_overrides.clear()


def test_list_and_review_require_moderator_permission(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "applicant4@example.com")
    request_response = client.post(
        "/api/v1/role-requests", json={"role_code": "ORGANIZER", "justification": "x"}
    )
    request_id = request_response.json()["id"]

    list_response = client.get("/api/v1/role-requests")
    assert list_response.status_code == 403, list_response.text

    patch_response = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert patch_response.status_code == 403, patch_response.text
    app.dependency_overrides.clear()


def test_moderator_approves_request_and_role_is_granted(monkeypatch):
    client, mail = setup_client(monkeypatch)
    _register(client, "mod2@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod2@example.com")

    _register(client, "applicant5@example.com")
    applicant_session = snapshot_session(client)
    request_response = client.post(
        "/api/v1/role-requests", json={"role_code": "ORGANIZER", "justification": "x"}
    )
    request_id = request_response.json()["id"]

    use_session(client, mod_session)
    list_response = client.get("/api/v1/role-requests", params={"status": "PENDING"})
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()) == 1

    patch_response = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["status"] == "APPROVED"
    assert len(mail["approved"]) == 1
    assert mail["approved"][0]["to"] == "applicant5@example.com"

    use_session(client, applicant_session)
    me_response = client.get("/api/v1/users/me")
    assert "ORGANIZER" in me_response.json()["roles"]
    app.dependency_overrides.clear()


def test_moderator_rejects_request_with_reason(monkeypatch):
    client, mail = setup_client(monkeypatch)
    _register(client, "mod3@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod3@example.com")

    _register(client, "applicant6@example.com")
    request_response = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "x"})
    request_id = request_response.json()["id"]

    use_session(client, mod_session)
    reject_without_reason = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "REJECTED"})
    assert reject_without_reason.status_code == 422, reject_without_reason.text

    reject_other_without_text = client.patch(
        f"/api/v1/role-requests/{request_id}", json={"status": "REJECTED", "reason_code": "OTHER"}
    )
    assert reject_other_without_text.status_code == 422, reject_other_without_text.text

    reject_response = client.patch(
        f"/api/v1/role-requests/{request_id}",
        json={"status": "REJECTED", "reason_code": "DUPLICATE_REQUEST"},
    )
    assert reject_response.status_code == 200, reject_response.text
    assert reject_response.json()["rejection_reason_code"] == "DUPLICATE_REQUEST"
    assert len(mail["rejected"]) == 1
    assert mail["rejected"][0]["to"] == "applicant6@example.com"
    app.dependency_overrides.clear()


def test_review_already_resolved_request_is_409(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "mod4@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod4@example.com")

    _register(client, "applicant7@example.com")
    request_response = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "x"})
    request_id = request_response.json()["id"]

    use_session(client, mod_session)
    first = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert first.status_code == 200, first.text

    second = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert second.status_code == 409, second.text
    app.dependency_overrides.clear()


def test_reapply_after_rejection_succeeds(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "mod6@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod6@example.com")

    _register(client, "applicant9@example.com")
    applicant_session = snapshot_session(client)
    first_request = client.post("/api/v1/role-requests", json={"role_code": "INSTRUCTOR", "justification": "x"})
    request_id = first_request.json()["id"]

    use_session(client, mod_session)
    reject = client.patch(
        f"/api/v1/role-requests/{request_id}", json={"status": "REJECTED", "reason_code": "NOT_RECOGNIZED"}
    )
    assert reject.status_code == 200, reject.text

    use_session(client, applicant_session)
    retry = client.post("/api/v1/role-requests", json={"role_code": "INSTRUCTOR", "justification": "y"})
    assert retry.status_code == 201, retry.text
    assert retry.json()["id"] != request_id
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_role_requests_api.py -v`
Expected: FAIL — `/api/v1/role-requests` routes don't exist yet (404s / connection errors from the test client's perspective, i.e. non-matching status codes).

- [ ] **Step 3: Write the router**

`backend/app/modules/role_requests/routers/__init__.py`:
```python
from .role_requests import router

__all__ = ["router"]
```

`backend/app/modules/role_requests/routers/role_requests.py`:
```python
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.email import EmailService
from app.core.identity_access import (
    User,
    get_emails_with_role_code,
    get_user_or_404,
    get_users_by_ids,
    has_permission,
)
from app.core.session_auth import get_current_user as get_session_user
from app.modules.role_requests.models.role_request import RoleRequest
from app.modules.role_requests.schemas.role_request import (
    RoleRequestCreateRequest,
    RoleRequestResponse,
    RoleRequestReviewRequest,
)
from app.modules.role_requests.services.role_request_service import RoleRequestService

router = APIRouter(prefix="/api/v1/role-requests", tags=["role-requests"])
logger = logging.getLogger(__name__)

REVIEW_PERMISSION = "role_requests.review"


async def require_review_permission(
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not await has_permission(session, current_user.id, REVIEW_PERMISSION):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to review role requests")
    return current_user


def _applicant_name(user: User) -> str:
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email


def _to_response(request_row: RoleRequest, applicant: User) -> RoleRequestResponse:
    return RoleRequestResponse(
        id=str(request_row.id),
        user_id=str(request_row.user_id),
        applicant_email=applicant.email,
        applicant_name=_applicant_name(applicant),
        role_code=request_row.role_code,
        status=request_row.status,
        justification=request_row.justification,
        reviewed_by=str(request_row.reviewed_by) if request_row.reviewed_by else None,
        reviewed_at=request_row.reviewed_at,
        rejection_reason_code=request_row.rejection_reason_code,
        rejection_reason_text=request_row.rejection_reason_text,
        created_at=request_row.created_at,
        updated_at=request_row.updated_at,
    )


@router.post("", response_model=RoleRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_role_request(
    payload: RoleRequestCreateRequest,
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> RoleRequestResponse:
    request_row = await RoleRequestService.create_request(
        session, user=current_user, role_code=payload.role_code, justification=payload.justification
    )
    await session.commit()

    for moderator_email in await get_emails_with_role_code(session, "MODERATOR"):
        try:
            await run_in_threadpool(
                EmailService.send_role_request_submitted,
                to=moderator_email,
                role_code=request_row.role_code,
                applicant_name=_applicant_name(current_user),
            )
        except Exception:
            logger.exception("Failed to send role-request-submitted email to %s", moderator_email)

    return _to_response(request_row, current_user)


@router.get("/me", response_model=list[RoleRequestResponse])
async def list_my_role_requests(
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> list[RoleRequestResponse]:
    requests = await RoleRequestService.list_for_user(session, current_user.id)
    return [_to_response(row, current_user) for row in requests]


@router.get("", response_model=list[RoleRequestResponse])
async def list_role_requests(
    status: str | None = Query(default=None),
    _: User = Depends(require_review_permission),
    session: AsyncSession = Depends(get_db),
) -> list[RoleRequestResponse]:
    requests = await RoleRequestService.list_for_review(session, status_filter=status)
    applicants = await get_users_by_ids(session, {row.user_id for row in requests})
    return [_to_response(row, applicants[row.user_id]) for row in requests]


@router.patch("/{request_id}", response_model=RoleRequestResponse)
async def review_role_request(
    request_id: str,
    payload: RoleRequestReviewRequest,
    reviewer: User = Depends(require_review_permission),
    session: AsyncSession = Depends(get_db),
) -> RoleRequestResponse:
    request_row = await RoleRequestService.review(
        session,
        request_id=request_id,
        reviewer=reviewer,
        decision=payload.status,
        reason_code=payload.reason_code,
        reason_text=payload.reason_text,
    )
    applicant = await get_user_or_404(session, request_row.user_id)
    await session.commit()

    try:
        if request_row.status == "APPROVED":
            await run_in_threadpool(
                EmailService.send_role_request_approved, to=applicant.email, role_code=request_row.role_code
            )
        else:
            await run_in_threadpool(
                EmailService.send_role_request_rejected,
                to=applicant.email,
                role_code=request_row.role_code,
                reason_code=request_row.rejection_reason_code or "",
                reason_text=request_row.rejection_reason_text,
            )
    except Exception:
        logger.exception("Failed to send role-request decision email for request_id=%s", request_id)

    return _to_response(request_row, applicant)
```

- [ ] **Step 4: Wire the router into `app/main.py`**

Add the import near the other module router imports:
```python
from app.modules.role_requests.routers import router as role_requests_router
```

Add the registration line near the other `app.include_router(...)` calls (after `app.include_router(auth_me_router)` is a reasonable spot, before the domain routers):
```python
app.include_router(role_requests_router)
```

- [ ] **Step 5: Run all new tests to verify they pass**

Run: `pytest backend/tests/test_role_requests_api.py -v`
Expected: PASS (9 passed).

- [ ] **Step 6: Run the full backend test suite to confirm no regressions**

Run: `pytest backend`
Expected: all tests pass, including the pre-existing suite.

- [ ] **Step 7: Commit**

```bash
git add backend/app/modules/role_requests/routers backend/app/main.py backend/tests/test_role_requests_api.py
git commit -m "feat(backend): role-requests router (create/list/review) wired into app"
```

---

### Task 7: Update `docs/clubs-domain.md` and `CLAUDE.md`

**Files:**
- Modify: `docs/clubs-domain.md`
- Modify: `CLAUDE.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update `docs/clubs-domain.md` rule 5**

Find (around line 103-106):
```markdown
5. Identity module changes should stay rare and deliberate. One documented
   exception exists: `email_verified_at` on `User`, added for email
   verification at registration — see
   `docs/superpowers/specs/2026-09-14-email-verification-design.md`.
```

Replace with:
```markdown
5. Identity module changes should stay rare and deliberate. Two documented
   exceptions exist: `email_verified_at` on `User`, added for email
   verification at registration — see
   `docs/superpowers/specs/2026-09-14-email-verification-design.md` — and
   `AuthService.assign_role`/`identity_access.assign_role`, the write path
   the `role_requests` module uses to grant a role once a request is
   approved — see
   `docs/superpowers/specs/2026-09-15-role-requests-design.md`.
```

- [ ] **Step 2: Update `CLAUDE.md`'s identity section**

Find the sentence:
```markdown
One deliberate, documented exception to that constraint: `email_verified_at` lives on identity's `User` model, added for email verification at registration — see `docs/superpowers/specs/2026-09-14-email-verification-design.md` for why.
```

Replace with:
```markdown
One deliberate, documented exception to that constraint: `email_verified_at` lives on identity's `User` model, added for email verification at registration — see `docs/superpowers/specs/2026-09-14-email-verification-design.md` for why.

A second: `AuthService.assign_role` (identity) and its `app/core/identity_access.py` wrapper `assign_role` are the only place a `UserRole` row gets created outside registration's default `USER` grant — the `role_requests` module (self-service requests for `INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR`, reviewed by whoever holds `MODERATOR`) calls this once a request is approved rather than writing to identity's tables itself. See `docs/superpowers/specs/2026-09-15-role-requests-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/clubs-domain.md CLAUDE.md
git commit -m "docs: document the second identity write exception (role_requests → assign_role)"
```

---

## Not in this plan

- Frontend (`/profile` request form + status list, `/moderation/role-requests` review page) — separate task per the spec, after this backend lands.
- Running this migration against a real Postgres database — do that afterward using the project's existing Postgres-verification workflow, not as part of this plan's automated steps.
- Club-scoped roles, role revocation, document-based verification — explicitly out of scope per the design spec.
