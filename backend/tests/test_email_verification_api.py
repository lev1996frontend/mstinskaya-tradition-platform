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


def setup_client_with_failing_email(monkeypatch):
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

    def _raise(*, to, verify_url, **_):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(email_module.EmailService, "send_verification_email", staticmethod(_raise))

    return TestClient(app)


def test_register_succeeds_even_if_email_send_fails(monkeypatch):
    client = setup_client_with_failing_email(monkeypatch)
    _register(client)
    app.dependency_overrides.clear()


def test_resend_verification_succeeds_even_if_email_send_fails(monkeypatch):
    client, sent_emails = setup_client(monkeypatch)
    _register(client)
    assert len(sent_emails) == 1

    def _raise(*, to, verify_url, **_):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(email_module.EmailService, "send_verification_email", staticmethod(_raise))

    response = client.post("/api/v1/auth/resend-verification")
    assert response.status_code == 200, response.text
    app.dependency_overrides.clear()
