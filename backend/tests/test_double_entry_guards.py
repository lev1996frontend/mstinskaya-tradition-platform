"""Один профиль не заявляется в одну дисциплину дважды.

Индекс частичный: заявка вручную (без профиля) не обязана быть уникальной по
имени — полные тёзки возможны, и схема не вправе их запрещать.
"""

import asyncio
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base

EVENT_YEAR = 2026
START_DATE = date(EVENT_YEAR, 5, 16).isoformat()


def setup_app_for_tests():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

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


def register(client, email: str) -> tuple[str, dict[str, str]]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор"},
    )
    assert response.status_code == 201, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    return me.json()["id"], headers


def register_athlete(client, email: str, first_name: str, last_name: str) -> tuple[str, dict]:
    """Учётка с профилем бойца; возвращает id атлета и заголовки."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "first_name": first_name,
            "last_name": last_name,
        },
    )
    assert response.status_code == 201, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    user_id = client.get("/api/v1/users/me", headers=headers).json()["id"]
    athlete = client.post("/api/v1/athletes", json={"user_id": user_id})
    assert athlete.status_code == 201, athlete.text
    return athlete.json()["id"], headers


def bootstrap(client):
    """A tournament with three disciplines, one of them age-bounded."""
    organizer_id, headers = register(client, "organizer@example.com")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Мстинская традиция 2026",
            "status": "REGISTRATION",
            "start_date": START_DATE,
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    for name, extra in (
        ("Абсолютная мужская", {}),
        ("Абсолютная ветеранская", {"min_age": 45}),
        ("Абсолютная детская", {"max_age": 14}),
    ):
        created = client.post(
            f"/api/v1/tournaments/{tournament_id}/competitions",
            json={
                "tournament_id": tournament_id,
                "name": name,
                "type": "INDIVIDUAL",
                "format": "SINGLE_ELIMINATION",
                "status": "REGISTRATION",
                **extra,
            },
        )
        assert created.status_code == 201, created.text
    return tournament_id, headers


def test_one_profile_cannot_be_entered_twice_in_a_discipline():
    """Инвариант предметной области, а не защита от кликов, — потому в схеме."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    absolute = next(c for c in competitions if c["name"] == "Абсолютная мужская")

    athlete_id, _ = register_athlete(client, "boec@example.com", "Иван", "Иванов")

    first = client.post(
        f"/api/v1/competitions/{absolute['id']}/participants",
        json={"competition_id": absolute["id"], "display_name": "Иван Иванов", "athlete_id": athlete_id},
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/api/v1/competitions/{absolute['id']}/participants",
        json={"competition_id": absolute["id"], "display_name": "Иван Иванов", "athlete_id": athlete_id},
    )
    assert second.status_code == 409, second.text


def test_namesakes_without_profiles_are_still_allowed():
    """Полные тёзки — вещь возможная, и схема не вправе их запрещать."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    absolute = next(c for c in competitions if c["name"] == "Абсолютная мужская")

    for _ in range(2):
        created = client.post(
            f"/api/v1/competitions/{absolute['id']}/participants",
            json={"competition_id": absolute["id"], "display_name": "Иван Иванов"},
        )
        assert created.status_code == 201, created.text
