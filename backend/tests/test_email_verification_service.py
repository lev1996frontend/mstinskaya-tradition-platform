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
