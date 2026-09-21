import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base
from tests.auth_test_helpers import snapshot_session, use_session


def setup_client():
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
    return TestClient(app)


def test_refresh_rotation_and_logout():
    """Tokens never appear in a JSON body (see auth/router.py) — this drives
    the whole rotation/reuse/logout lifecycle through the cookie jar instead,
    using ``snapshot_session``/``use_session`` to hold onto an
    already-superseded session and prove it is rejected."""
    client = setup_client()
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth-foundation@example.com",
            "password": "StrongPassword123!",
            "first_name": "Auth",
            "last_name": "Foundation", "privacy_consent": True,
        },
    )
    assert response.status_code == 201, response.text
    first_session = snapshot_session(client)
    assert first_session.get("refresh_token")

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200, refreshed.text
    second_session = snapshot_session(client)
    assert second_session["refresh_token"] != first_session["refresh_token"]

    use_session(client, first_session)
    reused = client.post("/api/v1/auth/refresh")
    assert reused.status_code == 401, reused.text

    use_session(client, second_session)
    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 200, logout.text
    assert "refresh_token" not in client.cookies

    use_session(client, second_session)
    after_logout = client.post("/api/v1/auth/refresh")
    assert after_logout.status_code == 401, after_logout.text

    app.dependency_overrides.clear()
