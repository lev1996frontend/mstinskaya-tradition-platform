import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base


@pytest.fixture(scope="module")
def client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())

    def override_get_db():
        async def _override():
            async with database_module.AsyncSessionLocal() as session:
                yield session

        return _override

    app.dependency_overrides[database_module.get_db] = override_get_db()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_register_and_login(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@example.com",
            "password": "StrongPassword123!",
            "first_name": "Example",
            "last_name": "User",
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" in payload

    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "user@example.com",
            "password": "StrongPassword123!",
        },
    )

    assert login.status_code == 200, login.text
    token_payload = login.json()
    assert "access_token" in token_payload
    assert "refresh_token" in token_payload


def test_current_user_requires_token(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_current_user_returns_profile_and_roles(client):
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": "second@example.com",
            "password": "StrongPassword123!",
            "first_name": "Second",
            "last_name": "User",
        },
    )
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]

    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == "second@example.com"
    assert body["name"] == "Second User"
    assert body["roles"]
    assert body["profile"] is not None
