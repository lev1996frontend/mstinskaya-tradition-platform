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


def test_rating_history_foundation_flow():
    client = setup_app_for_tests()

    user = client.post(
        "/api/v1/auth/register",
        json={
            "email": "athlete@example.com",
            "password": "StrongPassword123!",
            "first_name": "Rated",
            "last_name": "Athlete",
        },
    )
    assert user.status_code == 201, user.text
    token = user.json()["access_token"]
    me = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200, me.text
    athlete_user_id = me.json()["id"]

    athlete = client.post(
        "/api/v1/athletes",
        json={
            "user_id": athlete_user_id,
            "nickname": "TopAthlete",
            "experience_years": 5,
            "level": "INSTRUCTOR",
        },
    )
    assert athlete.status_code == 201, athlete.text
    athlete_id = athlete.json()["id"]

    ruleset = client.post(
        "/api/v1/rulesets",
        json={
            "title": "Rating Ruleset",
            "description": "Competition rules",
            "version": "2026.1",
            "status": "ACTIVE",
        },
    )
    assert ruleset.status_code == 201, ruleset.text
    ruleset_id = ruleset.json()["id"]

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Regional Cup",
            "description": "City tournament",
            "status": "ACTIVE",
            "start_date": "2026-09-10T10:00:00Z",
            "end_date": "2026-09-11T18:00:00Z",
            "location": "Main Hall",
            "city": "Minsk",
            "country": "Belarus",
            "organizer_id": athlete_user_id,
            "ruleset_id": ruleset_id,
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    category = client.post(
        f"/api/v1/tournaments/{tournament_id}/categories",
        json={
            "name": "Welterweight",
            "description": "Middle category",
        },
    )
    assert category.status_code == 201, category.text
    category_id = category.json()["id"]

    competition = client.post(
        "/api/v1/ratings/competitions",
        json={
            "athlete_id": athlete_id,
            "tournament_id": tournament_id,
            "category_id": category_id,
            "place": 1,
            "result": "WINNER",
            "matches_count": 3,
            "wins_count": 3,
            "losses_count": 0,
        },
    )
    assert competition.status_code == 201, competition.text
    assert competition.json()["result"] == "WINNER"

    achievement = client.post(
        "/api/v1/ratings/achievements",
        json={
            "athlete_id": athlete_id,
            "title": "City Cup Winner",
            "description": "Won the regional cup",
            "type": "TITLE",
            "issued_date": "2026-09-12T00:00:00Z",
        },
    )
    assert achievement.status_code == 201, achievement.text
    assert achievement.json()["type"] == "TITLE"

    rating_profile = client.post(
        "/api/v1/ratings/profiles",
        json={
            "athlete_id": athlete_id,
            "rating_points": 1200,
            "rank_position": 3,
        },
    )
    assert rating_profile.status_code == 201, rating_profile.text
    assert rating_profile.json()["rating_points"] == 1200

    event = client.post(
        "/api/v1/ratings/events",
        json={
            "athlete_id": athlete_id,
            "tournament_id": tournament_id,
            "points": 50,
            "reason": "Regional victory",
        },
    )
    assert event.status_code == 201, event.text
    assert event.json()["points"] == 50

    app.dependency_overrides.clear()
