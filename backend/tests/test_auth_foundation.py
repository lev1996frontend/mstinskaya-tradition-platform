import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base


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
    client = setup_client()
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth-foundation@example.com",
            "password": "StrongPassword123!",
            "first_name": "Auth",
            "last_name": "Foundation",
        },
    )
    assert response.status_code == 201, response.text
    first_pair = response.json()

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": first_pair["refresh_token"]})
    assert refreshed.status_code == 200, refreshed.text
    second_pair = refreshed.json()
    assert second_pair["refresh_token"] != first_pair["refresh_token"]

    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": first_pair["refresh_token"]})
    assert reused.status_code == 401, reused.text

    logout = client.post("/api/v1/auth/logout", json={"refresh_token": second_pair["refresh_token"]})
    assert logout.status_code == 200, logout.text

    after_logout = client.post("/api/v1/auth/refresh", json={"refresh_token": second_pair["refresh_token"]})
    assert after_logout.status_code == 401, after_logout.text

    app.dependency_overrides.clear()
