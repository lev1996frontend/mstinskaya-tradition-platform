# Email Verification At Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registered users receive an email with a link that confirms their address; `/users/me` reports verification status; the frontend shows a dismiss-free reminder banner with a rate-limited, cooldown-guarded resend action until they click it.

**Architecture:** A new `EmailService` (`app/core/email.py`) wraps the Resend transactional API with a dev-mode log fallback when no API key is configured. Registration generates a random, hashed, single-use token (mirroring the existing `RefreshToken` pattern) stored in a new `email_verification_tokens` table owned by the `auth` module; `users.email_verified_at` (a column added to identity's `User`, a deliberate documented exception — see Task 2) records the outcome. Two new `auth` endpoints (`/verify-email`, `/resend-verification`) complete the loop. The frontend gets one new page (`/verify-email`) and one banner component wired into the root layout.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, `resend` (new dependency), Next.js App Router, `fetch`-based `apiRequest` client, React Context (`AuthProvider`).

**Spec:** `docs/superpowers/specs/2026-09-14-email-verification-design.md`

## Global Constraints

- Tokens are never stored raw — only `sha256` hex digest via the existing `hash_token` (`app/modules/auth/security.py`), exactly as `RefreshToken` already does.
- Registration must succeed even if the email send fails — log and continue, never raise.
- No new frontend automated test infrastructure — the two new frontend pieces are verified manually against the dev server, per spec.
- Every new/changed backend behavior gets a real `pytest` test that runs against the in-memory SQLite setup already used throughout `backend/tests/`; the rate limiter is disabled under `pytest` (`app/core/rate_limit.py`: `enabled="pytest" not in sys.modules`), so rate-limit behavior itself is not testable here — apply the decorator, don't write a test asserting `429`.
- `docs/clubs-domain.md` rule 5 ("Identity module must not be modified") is deliberately broken by this plan (Task 2) — documented, not silent.

---

### Task 1: Email-sending infrastructure

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/core/config.py`
- Create: `backend/app/core/email.py`
- Modify: `backend/.env.example`
- Test: `backend/tests/test_email_service.py`

**Interfaces:**
- Produces: `EmailService.send_verification_email(*, to: str, verify_url: str, settings: Settings | None = None) -> None` (static method) — every later task that needs to send this email calls exactly this signature.
- Produces: `Settings.resend_api_key: str | None`, `Settings.email_from: str`, `Settings.frontend_base_url: str` on `app.core.config.Settings`.

- [ ] **Step 1: Add the `resend` dependency**

Run (from `backend/`, with the project's venv active):
```bash
pip install resend
pip freeze | grep -i "^resend=="
```
Take the exact version line printed (e.g. `resend==2.5.1`) and append it to `backend/requirements.txt`, after the existing `slowapi==0.1.9` line, with a one-line comment:
```
# Transactional email (verification, later password reset) — see app/core/email.py.
resend==<version printed above>
```

- [ ] **Step 2: Add settings fields**

In `backend/app/core/config.py`, inside `class Settings(BaseSettings):`, add these three fields right after `cookie_secure: bool | None = None`:

```python
    #: Resend API key. Unset in development/test on purpose — `EmailService`
    #: logs instead of sending for real when this is `None`, so neither local
    #: dev nor the test suite needs a real account.
    resend_api_key: str | None = None
    #: Must be a sender address on a domain verified in Resend, or delivery to
    #: anyone but the Resend account owner silently fails.
    email_from: str = "Мстинская традиция <onboarding@resend.dev>"
    #: Used to build links inside emails (e.g. the email-verification link) —
    #: the frontend's own origin, not this API's.
    frontend_base_url: str = "http://localhost:3000"
```

- [ ] **Step 3: Write the failing test for the dev-mode (no API key) path**

Create `backend/tests/test_email_service.py`:

```python
import logging

from app.core.config import Settings
from app.core.email import EmailService


def _dev_settings() -> Settings:
    return Settings(resend_api_key=None, email_from="Test <test@example.com>", frontend_base_url="http://localhost:3000")


def test_send_verification_email_logs_instead_of_sending_without_api_key(caplog):
    with caplog.at_level(logging.INFO):
        EmailService.send_verification_email(
            to="someone@example.com",
            verify_url="http://localhost:3000/verify-email?token=abc123",
            settings=_dev_settings(),
        )
    assert "someone@example.com" in caplog.text
    assert "http://localhost:3000/verify-email?token=abc123" in caplog.text
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pytest backend/tests/test_email_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.email'` (the module doesn't exist yet).

- [ ] **Step 5: Implement `EmailService`**

Create `backend/app/core/email.py`:

```python
from __future__ import annotations

import logging

import resend

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Thin wrapper around Resend. `settings` is an explicit optional
    parameter (not always read from `get_settings()` internally) so tests can
    pass a throwaway `Settings` instance without touching the process-wide,
    `lru_cache`d one."""

    @staticmethod
    def send_verification_email(*, to: str, verify_url: str, settings: Settings | None = None) -> None:
        settings = settings or get_settings()
        subject = "Подтвердите почту — Мстинская традиция"
        html = (
            f"<p>Перейдите по ссылке, чтобы подтвердить почту:</p>"
            f'<p><a href="{verify_url}">{verify_url}</a></p>'
            f"<p>Ссылка действует 24 часа.</p>"
        )
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r url=%s", to, subject, verify_url)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pytest backend/tests/test_email_service.py -v`
Expected: PASS

- [ ] **Step 7: Write and run the failing-then-passing test for the real-send path**

Append to `backend/tests/test_email_service.py`:

```python
def test_send_verification_email_calls_resend_with_api_key(monkeypatch):
    calls = []
    monkeypatch.setattr("app.core.email.resend.Emails.send", lambda payload: calls.append(payload))

    settings = Settings(
        resend_api_key="re_test_key",
        email_from="Test <test@example.com>",
        frontend_base_url="http://localhost:3000",
    )
    EmailService.send_verification_email(
        to="someone@example.com",
        verify_url="http://localhost:3000/verify-email?token=abc123",
        settings=settings,
    )

    assert len(calls) == 1
    assert calls[0]["to"] == ["someone@example.com"]
    assert calls[0]["from"] == "Test <test@example.com>"
    assert "abc123" in calls[0]["html"]
```

Run: `pytest backend/tests/test_email_service.py -v`
Expected: PASS (both tests). If the second one fails with an import/attribute error, double check `import resend` succeeded in Step 5 — rerun `pip install resend` if not.

- [ ] **Step 8: Document the new env vars**

In `backend/.env.example`, append after the `# COOKIE_SECURE=true` line:

```
# Email (Resend) — https://resend.com. Leave RESEND_API_KEY unset in
# development/test: EmailService logs the email instead of sending it.
# RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Мстинская традиция <noreply@ваш-домен>
FRONTEND_BASE_URL=http://localhost:3000
```

- [ ] **Step 9: Commit**

```bash
git add backend/requirements.txt backend/app/core/config.py backend/app/core/email.py backend/.env.example backend/tests/test_email_service.py
git commit -m "feat(backend): add Resend-backed email service"
```

---

### Task 2: Data model — verification token table and `User.email_verified_at`

**Files:**
- Modify: `backend/app/modules/identity/models/user.py`
- Modify: `backend/app/modules/auth/models/auth_records.py`
- Modify: `backend/app/modules/auth/models/__init__.py`
- Create: `backend/migrations/versions/20260914_email_verification.py`
- Test: `backend/tests/test_email_verification_models.py`

**Interfaces:**
- Produces: `app.modules.identity.models.User.email_verified_at: datetime | None`.
- Produces: `app.modules.auth.models.EmailVerificationToken` — fields `id: UUID`, `user_id: UUID`, `token_hash: str`, `expires_at: datetime`, `used_at: datetime | None`, `created_at: datetime`.
- Consumes: nothing from Task 1.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_email_verification_models.py`:

```python
import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base
from app.modules.auth.models import EmailVerificationToken
from app.modules.identity.models import User


def test_user_has_email_verified_at_and_token_table_round_trips():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as session:
            user = User(
                email="model-test@example.com",
                password_hash="x",
                first_name="Model",
                last_name="Test",
                status="active",
            )
            session.add(user)
            await session.flush()
            assert user.email_verified_at is None

            token = EmailVerificationToken(
                id=uuid4(),
                user_id=user.id,
                token_hash="a" * 64,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
                used_at=None,
                created_at=datetime.now(timezone.utc),
            )
            session.add(token)
            await session.flush()
            await session.refresh(token)
            assert token.used_at is None

            user.email_verified_at = datetime.now(timezone.utc)
            await session.flush()
            await session.refresh(user)
            assert user.email_verified_at is not None

        await engine.dispose()

    asyncio.run(run())
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pytest backend/tests/test_email_verification_models.py -v`
Expected: FAIL — `ImportError: cannot import name 'EmailVerificationToken' from 'app.modules.auth.models'`.

- [ ] **Step 3: Add `email_verified_at` to `User`**

In `backend/app/modules/identity/models/user.py`, change the import line:
```python
from sqlalchemy import String, UniqueConstraint
```
to:
```python
from sqlalchemy import DateTime, String, UniqueConstraint
```
Then add this field right after `status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")`:
```python
    #: NULL until the user clicks the link in their verification email.
    #: Deliberate, documented exception to `docs/clubs-domain.md` rule 5
    #: ("Identity module must not be modified") — see
    #: docs/superpowers/specs/2026-09-14-email-verification-design.md.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4: Add `EmailVerificationToken`**

In `backend/app/modules/auth/models/auth_records.py`, append after the `RefreshToken` class (before `class AuditLog`):

```python
class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship("User")
```

Then update `backend/app/modules/auth/models/__init__.py` to:
```python
from .auth_records import AuditLog, EmailVerificationToken, RefreshToken

__all__ = ["RefreshToken", "AuditLog", "EmailVerificationToken"]
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pytest backend/tests/test_email_verification_models.py -v`
Expected: PASS

- [ ] **Step 6: Write the Alembic migration**

Create `backend/migrations/versions/20260914_email_verification.py`:

```python
"""подтверждение почты при регистрации

email_verification_tokens (auth) хранит только sha256-хеш токена — та же
бухгалтерия, что у refresh_tokens. users.email_verified_at — колонка на
identity's User, сознательное исключение из docs/clubs-domain.md rule 5, см.
docs/superpowers/specs/2026-09-14-email-verification-design.md.

Revision ID: 20260914_email_verification
Revises: 20260908_file_storage
Create Date: 2026-09-14 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260914_email_verification"
down_revision = "20260908_file_storage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"])
    op.create_index(
        "ix_email_verification_tokens_token_hash",
        "email_verification_tokens",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_email_verification_tokens_token_hash", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "email_verified_at")
```

- [ ] **Step 7: Verify the migration runs against real Postgres**

If a local Postgres is reachable (see `docs/database.md`/`docker compose up postgres` from `backend/`):
```bash
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```
Expected: all three succeed with no errors. If no Postgres is reachable in this environment, skip this step and note it in the task's final report — the SQLite model test in Step 5 already exercises the schema shape, but not the real migration file.

- [ ] **Step 8: Commit**

```bash
git add backend/app/modules/identity/models/user.py backend/app/modules/auth/models/auth_records.py backend/app/modules/auth/models/__init__.py backend/migrations/versions/20260914_email_verification.py backend/tests/test_email_verification_models.py
git commit -m "feat(backend): add email_verified_at and email_verification_tokens"
```

---

### Task 3: `AuthService` — token issuance, verification, resend logic

**Files:**
- Modify: `backend/app/modules/auth/services/auth_service.py`
- Modify: `backend/app/modules/auth/schemas/auth.py`
- Modify: `backend/app/modules/auth/schemas/__init__.py`
- Test: `backend/tests/test_email_verification_service.py`

**Interfaces:**
- Consumes: `app.modules.auth.models.EmailVerificationToken` (Task 2), `app.modules.auth.security.hash_token` (already exists).
- Produces: `AuthService.create_email_verification_token(session, user_id: UUID) -> str` (returns the raw token).
- Produces: `AuthService.verify_email(session, raw_token: str) -> User` (raises `HTTPException(400)` for unknown/used token, `HTTPException(410)` for expired).
- Produces: `AuthService.resend_verification(session, user: User) -> str | None` (returns new raw token, or `None` if `user.email_verified_at` is already set).
- Produces: `VerifyEmailRequest` schema (`app.modules.auth.schemas`) — `{token: str}`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_email_verification_service.py`:

```python
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base
from app.modules.auth.models import EmailVerificationToken
from app.modules.auth.security import hash_token
from app.modules.auth.services.auth_service import AuthService
from app.modules.identity.models import User


async def _make_session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False), engine


async def _make_user(session: AsyncSession, email: str = "svc-test@example.com") -> User:
    user = User(email=email, password_hash="x", first_name="Svc", last_name="Test", status="active")
    session.add(user)
    await session.flush()
    return user


def test_create_and_verify_email_token_marks_user_verified():
    async def run():
        session_factory, engine = await _make_session_factory()
        async with session_factory() as session:
            user = await _make_user(session)
            raw_token = await AuthService.create_email_verification_token(session, user.id)
            assert raw_token

            verified_user = await AuthService.verify_email(session, raw_token)
            assert verified_user.id == user.id
            assert verified_user.email_verified_at is not None
        await engine.dispose()

    asyncio.run(run())


def test_verify_email_rejects_unknown_token():
    async def run():
        session_factory, engine = await _make_session_factory()
        async with session_factory() as session:
            with pytest.raises(HTTPException) as exc_info:
                await AuthService.verify_email(session, "not-a-real-token")
            assert exc_info.value.status_code == 400
        await engine.dispose()

    asyncio.run(run())


def test_verify_email_rejects_already_used_token():
    async def run():
        session_factory, engine = await _make_session_factory()
        async with session_factory() as session:
            user = await _make_user(session)
            raw_token = await AuthService.create_email_verification_token(session, user.id)
            await AuthService.verify_email(session, raw_token)

            with pytest.raises(HTTPException) as exc_info:
                await AuthService.verify_email(session, raw_token)
            assert exc_info.value.status_code == 400
        await engine.dispose()

    asyncio.run(run())


def test_verify_email_rejects_expired_token():
    async def run():
        session_factory, engine = await _make_session_factory()
        async with session_factory() as session:
            user = await _make_user(session)
            raw_token = "expired-raw-token"
            session.add(
                EmailVerificationToken(
                    user_id=user.id,
                    token_hash=hash_token(raw_token),
                    expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
                    used_at=None,
                    created_at=datetime.now(timezone.utc),
                )
            )
            await session.flush()

            with pytest.raises(HTTPException) as exc_info:
                await AuthService.verify_email(session, raw_token)
            assert exc_info.value.status_code == 410
        await engine.dispose()

    asyncio.run(run())


def test_resend_verification_invalidates_previous_token_and_returns_new_one():
    async def run():
        session_factory, engine = await _make_session_factory()
        async with session_factory() as session:
            user = await _make_user(session)
            first_token = await AuthService.create_email_verification_token(session, user.id)

            second_token = await AuthService.resend_verification(session, user)
            assert second_token is not None
            assert second_token != first_token

            # the first token no longer verifies
            with pytest.raises(HTTPException) as exc_info:
                await AuthService.verify_email(session, first_token)
            assert exc_info.value.status_code == 400

            # the second one does
            verified_user = await AuthService.verify_email(session, second_token)
            assert verified_user.email_verified_at is not None
        await engine.dispose()

    asyncio.run(run())


def test_resend_verification_is_noop_once_verified():
    async def run():
        session_factory, engine = await _make_session_factory()
        async with session_factory() as session:
            user = await _make_user(session)
            raw_token = await AuthService.create_email_verification_token(session, user.id)
            await AuthService.verify_email(session, raw_token)

            result = await AuthService.resend_verification(session, user)
            assert result is None
        await engine.dispose()

    asyncio.run(run())
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pytest backend/tests/test_email_verification_service.py -v`
Expected: FAIL — `AttributeError: type object 'AuthService' has no attribute 'create_email_verification_token'`.

- [ ] **Step 3: Add the `VerifyEmailRequest` schema**

In `backend/app/modules/auth/schemas/auth.py`, append:
```python
class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    token: str = Field(..., min_length=1)
```

Update `backend/app/modules/auth/schemas/__init__.py` to:
```python
from .auth import LoginRequest, MessageResponse, RegisterRequest, VerifyEmailRequest

__all__ = ["RegisterRequest", "LoginRequest", "MessageResponse", "VerifyEmailRequest"]
```

- [ ] **Step 4: Implement the service methods**

In `backend/app/modules/auth/services/auth_service.py`, change the imports at the top from:
```python
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identity_access import User, get_user
from app.core.identity_access import has_permission as identity_has_permission
from app.modules.auth.models import AuditLog, RefreshToken
from app.modules.auth.security import create_access_token, create_refresh_token, decode_token, hash_token
from app.modules.identity.services.auth_service import AuthService as IdentityAuthService
```
to:
```python
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identity_access import User, get_user
from app.core.identity_access import has_permission as identity_has_permission
from app.modules.auth.models import AuditLog, EmailVerificationToken, RefreshToken
from app.modules.auth.security import create_access_token, create_refresh_token, decode_token, hash_token
from app.modules.identity.services.auth_service import AuthService as IdentityAuthService

EMAIL_VERIFICATION_TOKEN_EXPIRES = timedelta(hours=24)
```

Then add these methods inside `class AuthService:`, after `audit` (the last existing method):

```python
    @staticmethod
    async def create_email_verification_token(session: AsyncSession, user_id: UUID) -> str:
        raw_token = secrets.token_urlsafe(32)
        session.add(
            EmailVerificationToken(
                user_id=user_id,
                token_hash=hash_token(raw_token),
                expires_at=datetime.now(timezone.utc) + EMAIL_VERIFICATION_TOKEN_EXPIRES,
                used_at=None,
                created_at=datetime.now(timezone.utc),
            )
        )
        await session.flush()
        return raw_token

    @staticmethod
    async def verify_email(session: AsyncSession, raw_token: str) -> User:
        record = await session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.token_hash == hash_token(raw_token))
        )
        if record is None or record.used_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Verification token expired")

        user = await get_user(session, record.user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        record.used_at = datetime.now(timezone.utc)
        user.email_verified_at = datetime.now(timezone.utc)
        await session.flush()
        return user

    @staticmethod
    async def resend_verification(session: AsyncSession, user: User) -> str | None:
        """`None` means already verified — the caller should treat this as a
        no-op and send no email, rather than issuing a token nobody needs."""
        if user.email_verified_at is not None:
            return None
        previous = await session.scalar(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.used_at.is_(None),
            )
        )
        if previous is not None:
            previous.used_at = datetime.now(timezone.utc)
        return await AuthService.create_email_verification_token(session, user.id)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest backend/tests/test_email_verification_service.py -v`
Expected: PASS (all 6 tests)

- [ ] **Step 6: Run the full backend test suite to check nothing else broke**

Run: `pytest backend/tests -v`
Expected: PASS (everything, including the pre-existing `test_auth_foundation.py` and `test_identity_auth.py`)

- [ ] **Step 7: Commit**

```bash
git add backend/app/modules/auth/services/auth_service.py backend/app/modules/auth/schemas/auth.py backend/app/modules/auth/schemas/__init__.py backend/tests/test_email_verification_service.py
git commit -m "feat(backend): add verification token issue/verify/resend logic"
```

---

### Task 4: Endpoints — register sends the email, `/verify-email`, `/resend-verification`, `/users/me` reports status

**Files:**
- Modify: `backend/app/modules/auth/router.py`
- Modify: `backend/app/modules/identity/schemas/auth.py`
- Modify: `backend/app/modules/identity/services/auth_service.py`

**Interfaces:**
- Consumes: `AuthService.create_email_verification_token`, `AuthService.verify_email`, `AuthService.resend_verification`, `VerifyEmailRequest` (Task 3); `EmailService.send_verification_email` (Task 1); `Settings.frontend_base_url` (Task 1).
- Produces: `POST /api/v1/auth/verify-email` (body: `{token}`) → `MessageResponse`, `400`/`410` on failure.
- Produces: `POST /api/v1/auth/resend-verification` (requires session cookie) → `MessageResponse`.
- Produces: `UserMeResponse.email_verified: bool` — Task 5's tests and the frontend (Tasks 7-9) both read this field from `GET /api/v1/users/me`.

- [ ] **Step 1: Add `email_verified` to `UserMeResponse` and `get_user_me`**

In `backend/app/modules/identity/schemas/auth.py`, change:
```python
class UserMeResponse(BaseModel):
    id: str
    email: str
    name: str
    roles: list[str]
    profile: dict | None
```
to:
```python
class UserMeResponse(BaseModel):
    id: str
    email: str
    name: str
    roles: list[str]
    profile: dict | None
    email_verified: bool
```

In `backend/app/modules/identity/services/auth_service.py`, inside `get_user_me`, change the returned dict from:
```python
        return {
            "id": str(user.id),
            "email": user.email,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "roles": role_names,
            "profile": {
                "id": str(profile.id),
                "display_name": profile.display_name,
                "bio": profile.bio,
                "avatar_url": profile.avatar_url,
            } if profile else None,
        }
```
to:
```python
        return {
            "id": str(user.id),
            "email": user.email,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "roles": role_names,
            "profile": {
                "id": str(profile.id),
                "display_name": profile.display_name,
                "bio": profile.bio,
                "avatar_url": profile.avatar_url,
            } if profile else None,
            "email_verified": user.email_verified_at is not None,
        }
```

- [ ] **Step 2: Wire email-sending into `register`, add the two new endpoints**

In `backend/app/modules/auth/router.py`:

Add to the imports (near the top, after `from app.core.rate_limit import limiter`):
```python
import logging

from app.core.email import EmailService
```
(`import logging` goes at the very top of the import block, before the `fastapi` import, per standard placement — `logger = logging.getLogger(__name__)` goes right after the `router = APIRouter(...)` line.)

After:
```python
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
```
add:
```python
logger = logging.getLogger(__name__)
```

Add `VerifyEmailRequest` to the existing schema import line — change:
```python
from app.modules.auth.schemas import LoginRequest, MessageResponse, RegisterRequest
```
to:
```python
from app.modules.auth.schemas import LoginRequest, MessageResponse, RegisterRequest, VerifyEmailRequest
```

Replace the existing `register` endpoint body:
```python
@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, payload: RegisterRequest, response: Response, session: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user, access_token, refresh_token = await AuthService.register(
        session,
        email=str(payload.email),
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    await AuthService.audit(session, user_id=user.id, action="REGISTER", entity_type="User", entity_id=str(user.id))
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return MessageResponse(message="Registered")
```
with:
```python
@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, payload: RegisterRequest, response: Response, session: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user, access_token, refresh_token = await AuthService.register(
        session,
        email=str(payload.email),
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    await AuthService.audit(session, user_id=user.id, action="REGISTER", entity_type="User", entity_id=str(user.id))
    raw_token = await AuthService.create_email_verification_token(session, user.id)
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)

    # Never fails registration: the row committed above is real regardless of
    # whether this send succeeds, and the user can always trigger
    # /resend-verification later.
    verify_url = f"{get_settings().frontend_base_url}/verify-email?token={raw_token}"
    try:
        EmailService.send_verification_email(to=str(payload.email), verify_url=verify_url)
    except Exception:
        logger.exception("Failed to send verification email for user_id=%s", user.id)

    return MessageResponse(message="Registered")
```

Then add these two endpoints at the end of the file (after the existing `logout` endpoint):
```python
@router.post("/verify-email", response_model=MessageResponse)
@limiter.limit("20/minute")
async def verify_email(
    request: Request, payload: VerifyEmailRequest, session: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await AuthService.verify_email(session, payload.token)
    await session.commit()
    return MessageResponse(message="Email verified")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> MessageResponse:
    raw_token = await AuthService.resend_verification(session, current_user)
    await session.commit()
    if raw_token is None:
        return MessageResponse(message="Email already verified")

    verify_url = f"{get_settings().frontend_base_url}/verify-email?token={raw_token}"
    try:
        EmailService.send_verification_email(to=current_user.email, verify_url=verify_url)
    except Exception:
        logger.exception("Failed to send verification email for user_id=%s", current_user.id)
    return MessageResponse(message="Verification email sent")
```

- [ ] **Step 3: Manually sanity-check the endpoints exist**

Run: `python -c "from app.main import app; print(sorted(r.path for r in app.routes if 'verify' in r.path or 'resend' in r.path))"` (from `backend/`, venv active)
Expected: prints a list including `/api/v1/auth/verify-email` and `/api/v1/auth/resend-verification`. This step is a smoke check, not a substitute for Task 5's real tests — if it errors, fix the import/syntax issue before moving on.

- [ ] **Step 4: Commit**

```bash
git add backend/app/modules/auth/router.py backend/app/modules/identity/schemas/auth.py backend/app/modules/identity/services/auth_service.py
git commit -m "feat(backend): wire verification email into register, add verify/resend endpoints"
```

---

### Task 5: End-to-end API tests

**Files:**
- Create: `backend/tests/test_email_verification_api.py`

**Interfaces:**
- Consumes: everything from Tasks 2-4 — this task only adds tests, no new production code.

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_email_verification_api.py`:

```python
import asyncio
import re
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.core import email as email_module
from app.main import app
from app.models.base import Base
from app.modules.auth.models import EmailVerificationToken
from app.modules.auth.security import hash_token


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

    sent_emails: list[dict[str, str]] = []
    monkeypatch.setattr(
        email_module.EmailService,
        "send_verification_email",
        staticmethod(lambda *, to, verify_url, **_: sent_emails.append({"to": to, "verify_url": verify_url})),
    )

    return TestClient(app), sent_emails


def _extract_token(verify_url: str) -> str:
    match = re.search(r"token=([^&]+)", verify_url)
    assert match, f"no token in {verify_url}"
    return match.group(1)


def _register(client: TestClient, email: str = "verify@example.com") -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "first_name": "Verify",
            "last_name": "Test",
        },
    )
    assert response.status_code == 201, response.text


def test_register_sends_verification_email(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == "verify@example.com"
    assert "token=" in sent_emails[0]["verify_url"]
    app.dependency_overrides.clear()


def test_users_me_reports_unverified_after_register(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client)
    me = client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    assert me.json()["email_verified"] is False
    app.dependency_overrides.clear()


def test_verify_email_with_valid_token_marks_user_verified(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    token = _extract_token(sent_emails[0]["verify_url"])

    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200, response.text

    me = client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    assert me.json()["email_verified"] is True
    app.dependency_overrides.clear()


def test_verify_email_rejects_reused_token(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    token = _extract_token(sent_emails[0]["verify_url"])

    first = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert first.status_code == 200, first.text

    second = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert second.status_code == 400, second.text
    app.dependency_overrides.clear()


def test_verify_email_rejects_unknown_token(monkeypatch):
    client, _ = setup_client(monkeypatch)
    response = client.post("/api/v1/auth/verify-email", json={"token": "not-a-real-token"})
    assert response.status_code == 400, response.text
    app.dependency_overrides.clear()


def test_verify_email_rejects_expired_token(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    token = _extract_token(sent_emails[0]["verify_url"])

    async def expire_token():
        async with database_module.AsyncSessionLocal() as session:
            record = await session.scalar(
                select(EmailVerificationToken).where(EmailVerificationToken.token_hash == hash_token(token))
            )
            record.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
            await session.commit()

    asyncio.run(expire_token())

    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 410, response.text
    app.dependency_overrides.clear()


def test_resend_verification_issues_new_usable_token_and_invalidates_old(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    first_token = _extract_token(sent_emails[0]["verify_url"])

    response = client.post("/api/v1/auth/resend-verification")
    assert response.status_code == 200, response.text
    assert len(sent_emails) == 2
    second_token = _extract_token(sent_emails[1]["verify_url"])
    assert second_token != first_token

    stale = client.post("/api/v1/auth/verify-email", json={"token": first_token})
    assert stale.status_code == 400, stale.text

    fresh = client.post("/api/v1/auth/verify-email", json={"token": second_token})
    assert fresh.status_code == 200, fresh.text
    app.dependency_overrides.clear()


def test_resend_verification_is_noop_once_verified(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    token = _extract_token(sent_emails[0]["verify_url"])
    client.post("/api/v1/auth/verify-email", json={"token": token})

    response = client.post("/api/v1/auth/resend-verification")
    assert response.status_code == 200, response.text
    assert len(sent_emails) == 1
    app.dependency_overrides.clear()


def test_resend_verification_requires_session(monkeypatch):
    client, _ = setup_client(monkeypatch)
    response = client.post("/api/v1/auth/resend-verification")
    assert response.status_code == 401, response.text
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run it**

Run: `pytest backend/tests/test_email_verification_api.py -v`
Expected: PASS (all 9 tests). If any fail, the failure is in Task 4's wiring, not this file — go back and check the exact endpoint paths/status codes against what's written there.

- [ ] **Step 3: Run the entire backend suite one more time**

Run: `pytest backend/tests -v`
Expected: PASS, full suite, no regressions.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_email_verification_api.py
git commit -m "test(backend): cover email verification register/verify/resend flow"
```

---

### Task 6: Update the two stale docs

**Files:**
- Modify: `docs/clubs-domain.md`
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `docs/clubs-domain.md`**

Find this block (near the end of the clubs domain rules):
```
2. One club can have multiple instructors.
3. Club owner manages members.
4. Club deletion should not delete users.
5. Identity module must not be modified.
```
Replace line 5 with:
```
5. Identity module changes should stay rare and deliberate. One documented
   exception exists: `email_verified_at` on `User`, added for email
   verification at registration — see
   `docs/superpowers/specs/2026-09-14-email-verification-design.md`.
```

- [ ] **Step 2: Update `CLAUDE.md`**

Find the section headed `### Known duplication: two auth implementations` (under `## Architecture`). Replace the entire section — from that heading through the paragraph ending "...suggesting `identity` may be the one to leave alone while `auth` evolves." — with:

```markdown
### Auth: one stack, `identity` supplies data underneath it

`app/modules/auth/` (router, service, schemas, `auth_records` model) is the
only auth stack — it owns `/api/v1/auth/register`, `/login`, `/refresh`,
`/logout`, and `/api/v1/users/me`. `identity`'s own `routers/auth.py` (its
never-reachable `/register`/`/login`, shadowed by `auth` being registered
first) was deleted; `identity` now supplies only what `auth` actually calls
into — the `User`/`Role`/`Profile`/`Permission` models and
`register_user`/`authenticate_user`/`get_user_me` — not its own HTTP surface.
Sessions are httpOnly cookies (`app/core/session_auth.py`), never a token in
a JSON body.

One deliberate, documented exception to "identity is data-only, don't modify
it otherwise": `email_verified_at` lives on identity's `User` model — see
`docs/superpowers/specs/2026-09-14-email-verification-design.md` for why.
```

- [ ] **Step 3: Commit**

```bash
git add docs/clubs-domain.md CLAUDE.md
git commit -m "docs: reconcile clubs-domain.md and CLAUDE.md with the single auth stack"
```

---

### Task 7: Frontend — API client, types, routes, `useAuth().refresh`

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/types/auth.ts`
- Modify: `frontend/src/lib/routes.ts`
- Modify: `frontend/src/features/auth/auth-context.tsx`

**Interfaces:**
- Produces: `verifyEmail(token: string) -> Promise<{message?: string}>`, `resendVerification() -> Promise<{message?: string}>` in `frontend/src/api/auth.ts`.
- Produces: `CurrentUser.email_verified: boolean`.
- Produces: `routes.verifyEmail() -> "/verify-email"`.
- Produces: `useAuth().refresh: () => Promise<void>` — re-fetches `/users/me` and updates the context's `user`, without throwing on a `401` (mirrors the existing mount-time `restore` behavior in the same file).
- No automated test — this task has no runtime behavior of its own to assert on beyond what TypeScript's compiler already checks; verified via `npx tsc --noEmit` (Step 4).

- [ ] **Step 1: Extend the API client**

In `frontend/src/api/auth.ts`, append:
```typescript
export const verifyEmail = (token: string) =>
  apiRequest<{ message?: string }>("/api/v1/auth/verify-email", { method: "POST", body: { token } });

export const resendVerification = () =>
  apiRequest<{ message?: string }>("/api/v1/auth/resend-verification", { method: "POST" });
```

- [ ] **Step 2: Extend `CurrentUser`**

In `frontend/src/types/auth.ts`, change:
```typescript
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  profile: Record<string, unknown> | null;
}
```
to:
```typescript
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  profile: Record<string, unknown> | null;
  // snake_case, matching the backend's `UserMeResponse` field name exactly —
  // this type already mirrors the backend 1:1 with no case conversion, so
  // `emailVerified` here would silently never match the real JSON key.
  email_verified: boolean;
}
```

- [ ] **Step 3: Add the route helper**

In `frontend/src/lib/routes.ts`, add inside the `routes` object, next to `register: () => "/register"`:
```typescript
  verifyEmail: () => "/verify-email",
```

- [ ] **Step 4: Add `refresh` to `AuthProvider`/`useAuth`**

In `frontend/src/features/auth/auth-context.tsx`, change the `AuthState` type from:
```typescript
type AuthState = {
  user: CurrentUser | null;
  /** True until the session cookie (if any) has been checked against `/users/me`. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};
```
to:
```typescript
type AuthState = {
  user: CurrentUser | null;
  /** True until the session cookie (if any) has been checked against `/users/me`. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetches `/users/me` and updates `user` — for anything that changes
   *  server-side account state without going through `login`/`register`
   *  (e.g. clicking the email verification link). */
  refresh: () => Promise<void>;
};
```

Then, inside `AuthProvider`, add this new callback right after the `logout` callback (before the `value = useMemo(...)` line):
```typescript
  const refresh = useCallback(async () => {
    try {
      setUser(await authApi.getCurrentUser());
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      setUser(null);
    }
  }, []);
```

Update the `value` memo from:
```typescript
  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
```
to:
```typescript
  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );
```

- [ ] **Step 5: Type-check**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors. If `email_verified` triggers an error anywhere `CurrentUser` is constructed by hand (unlikely — it's normally the raw API response cast to the type), fix that call site to include the field.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/types/auth.ts frontend/src/lib/routes.ts frontend/src/features/auth/auth-context.tsx
git commit -m "feat(frontend): add verify/resend API calls, email_verified type, refresh()"
```

---

### Task 8: Frontend — `/verify-email` page and the resend button

**Files:**
- Create: `frontend/src/features/auth/resend-verification-button.tsx`
- Create: `frontend/src/app/verify-email/page.tsx`

**Interfaces:**
- Consumes: `authApi.verifyEmail`, `authApi.resendVerification` (Task 7), `useAuth().refresh` (Task 7), `routes.home()`.
- Produces: `<ResendVerificationButton className?: string />` — a self-contained button with its own 60-second post-click cooldown; reused by Task 9's banner.
- Manual verification only (per Global Constraints) — Step 3 below is a manual dev-server check, not an automated test.

- [ ] **Step 1: Build the reusable resend button with a 60s cooldown**

Create `frontend/src/features/auth/resend-verification-button.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

import * as authApi from "@/api/auth";

const COOLDOWN_SECONDS = 60;

/**
 * Not a security measure — the server-side rate limit on
 * `/api/v1/auth/resend-verification` (3/hour, see `auth/router.py`) is what
 * actually stops abuse. This is just here so an impatient click doesn't fire
 * the request five times in a row before the first response even lands.
 */
export function ResendVerificationButton({ className }: { className?: string }) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleClick() {
    setStatus("sending");
    try {
      await authApi.resendVerification();
      setStatus("sent");
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setStatus("error");
    }
  }

  const disabled = cooldown > 0 || status === "sending";

  return (
    <button type="button" onClick={handleClick} disabled={disabled} className={className}>
      {cooldown > 0 ? `Отправить ещё раз (${cooldown}с)` : "Отправить письмо ещё раз"}
      {status === "error" ? <span className="ml-2 text-[var(--danger)]">Не удалось отправить</span> : null}
    </button>
  );
}
```

- [ ] **Step 2: Build the `/verify-email` page**

Create `frontend/src/app/verify-email/page.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import * as authApi from "@/api/auth";
import { useAuth } from "@/features/auth/auth-context";
import { ResendVerificationButton } from "@/features/auth/resend-verification-button";
import { ApiError } from "@/lib/api";
import { routes } from "@/lib/routes";

type Status = "checking" | "success" | "invalid" | "expired" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus("invalid");
      return;
    }

    async function run(rawToken: string) {
      try {
        await authApi.verifyEmail(rawToken);
        await refresh();
        setStatus("success");
      } catch (error) {
        if (error instanceof ApiError && error.status === 410) {
          setStatus("expired");
        } else if (error instanceof ApiError && error.status === 400) {
          setStatus("invalid");
        } else {
          setStatus("error");
        }
      }
    }

    void run(token);
  }, [token, refresh]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {status === "checking" ? <p className="text-[var(--muted)]">Подтверждаем почту…</p> : null}

      {status === "success" ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Почта подтверждена</h1>
          <Link href={routes.home()} className="mt-4 inline-block text-[var(--accent)] underline">
            На главную
          </Link>
        </>
      ) : null}

      {status === "expired" ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Срок ссылки истёк</h1>
          <p className="mt-2 text-[var(--muted)]">Ссылки действуют 24 часа — запросите новую.</p>
          {user ? (
            <ResendVerificationButton className="mt-4 text-[var(--accent)] underline disabled:opacity-50" />
          ) : (
            <Link href={routes.login()} className="mt-4 inline-block text-[var(--accent)] underline">
              Войти, чтобы запросить новое письмо
            </Link>
          )}
        </>
      ) : null}

      {status === "invalid" || status === "error" ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Ссылка недействительна</h1>
          <p className="mt-2 text-[var(--muted)]">
            Проверьте, что перешли по ссылке из письма целиком, или запросите новое.
          </p>
          {user ? (
            <ResendVerificationButton className="mt-4 text-[var(--accent)] underline disabled:opacity-50" />
          ) : (
            <Link href={routes.login()} className="mt-4 inline-block text-[var(--accent)] underline">
              Войти, чтобы запросить новое письмо
            </Link>
          )}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Manually verify against the dev server**

From `backend/`: `uvicorn app.main:app --reload` (leave `RESEND_API_KEY` unset — verification links will be logged to the terminal instead of emailed).
From `frontend/`: `npm run dev`.

1. Register a new account at `/register`.
2. In the backend terminal, find the logged line `EMAIL (dev, not sent): to=... url=http://localhost:3000/verify-email?token=...` and copy the URL.
3. Open that URL in the browser — expect "Почта подтверждена".
4. Open `/verify-email?token=garbage` — expect "Ссылка недействительна".
5. Open `/verify-email` with no `token` param at all — expect "Ссылка недействительна".
6. While logged in from step 1, click "Отправить ещё раз" — expect it to disable itself and show a counting-down `60с → 59с → …` label.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/auth/resend-verification-button.tsx frontend/src/app/verify-email/page.tsx
git commit -m "feat(frontend): add /verify-email page and resend button"
```

---

### Task 9: Frontend — reminder banner

**Files:**
- Create: `frontend/src/features/auth/email-verification-banner.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`user`, `loading`) (existing), `ResendVerificationButton` (Task 8).
- Manual verification only, per Global Constraints.

- [ ] **Step 1: Build the banner**

Create `frontend/src/features/auth/email-verification-banner.tsx`:
```tsx
"use client";

import { useAuth } from "@/features/auth/auth-context";
import { ResendVerificationButton } from "@/features/auth/resend-verification-button";

/**
 * Renders only once we know who's signed in (`!loading`) and their email is
 * unverified — never during the mount-time `/users/me` check, which would
 * otherwise flash the banner for every visitor for one render before
 * `loading` settles, verified or not, signed in or not.
 */
export function EmailVerificationBanner() {
  const { user, loading } = useAuth();
  if (loading || !user || user.email_verified) return null;

  return (
    <div className="border-b-2 border-[var(--rule)] bg-[var(--surface-muted)] px-4 py-2 text-center text-sm text-[var(--foreground)]">
      Подтвердите почту — мы отправили письмо на {user.email}.{" "}
      <ResendVerificationButton className="font-medium text-[var(--accent)] underline disabled:opacity-50" />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the root layout**

In `frontend/src/app/layout.tsx`, add the import:
```typescript
import { EmailVerificationBanner } from "@/features/auth/email-verification-banner";
```
next to the existing `import { SiteHeader } from "@/components/layout/site-header";` line.

Then change:
```tsx
            <RiverSpine />
            <SiteHeader />
            <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
```
to:
```tsx
            <RiverSpine />
            <SiteHeader />
            <EmailVerificationBanner />
            <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
```

- [ ] **Step 3: Manually verify against the dev server**

With both dev servers still running from Task 8:
1. Register a new account — the banner should appear under the header on every page.
2. Click its "Отправить письмо ещё раз" — same cooldown behavior as Task 8's page.
3. Follow the verification link from the backend log (as in Task 8) in the same browser session, then navigate back to any page in the app (client-side link, not a hard reload) — the banner should be gone, since `verify-email`'s `refresh()` updated the shared `AuthProvider` state.
4. Log out and back in as an already-verified account (or re-check the same one after step 3) — confirm the banner stays gone.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/auth/email-verification-banner.tsx frontend/src/app/layout.tsx
git commit -m "feat(frontend): show email verification reminder banner"
```
