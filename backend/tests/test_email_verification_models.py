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
