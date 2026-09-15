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
