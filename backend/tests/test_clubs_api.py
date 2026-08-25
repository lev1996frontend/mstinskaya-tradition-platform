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


def test_create_club_and_add_member():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "StrongPassword123!",
            "first_name": "Test",
            "last_name": "Owner",
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

    club_response = client.post(
        "/api/v1/clubs",
        json={
            "name": "Mstina Academy",
            "description": "Training club",
            "website_url": "https://example.com",
        },
    )

    assert club_response.status_code == 201, club_response.text
    club = club_response.json()
    assert club["name"] == "Mstina Academy"

    member_response = client.post(
        f"/api/v1/clubs/{club['id']}/members",
        json={
            "user_id": user_id,
            "role": "OWNER",
        },
    )

    assert member_response.status_code == 201, member_response.text
    member = member_response.json()
    assert member["role"] == "OWNER"
    assert member["club_id"] == club["id"]

    members_response = client.get(f"/api/v1/clubs/{club['id']}/members")
    assert members_response.status_code == 200, members_response.text
    members = members_response.json()
    assert len(members) == 1

    app.dependency_overrides.clear()
