import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base


def setup_app_for_tests():
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
    return TestClient(app)


def test_create_and_get_athlete_profile():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "athlete@example.com",
            "password": "StrongPassword123!",
            "first_name": "Athlete",
            "last_name": "User",
        },
    )
    assert register_response.status_code == 201, register_response.text
    token = register_response.json()["access_token"]

    me_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200, me_response.text
    user_id = me_response.json()["id"]

    create_response = client.post(
        "/api/v1/athletes",
        json={
            "user_id": user_id,
            "nickname": "IronFist",
            "birth_year": 1995,
            "experience_years": 6,
            "level": "PRACTITIONER",
            "bio": "Historical combat enthusiast",
            "photo_url": "https://example.com/avatar.png",
        },
    )
    assert create_response.status_code == 201, create_response.text
    athlete = create_response.json()
    assert athlete["user_id"] == user_id
    assert athlete["nickname"] == "IronFist"
    assert athlete["level"] == "PRACTITIONER"

    fetched = client.get(f"/api/v1/athletes/{athlete['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["nickname"] == "IronFist"

    by_user = client.get(f"/api/v1/athletes/user/{user_id}")
    assert by_user.status_code == 200, by_user.text
    assert by_user.json()["id"] == athlete["id"]

    app.dependency_overrides.clear()
