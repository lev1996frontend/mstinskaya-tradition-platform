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
