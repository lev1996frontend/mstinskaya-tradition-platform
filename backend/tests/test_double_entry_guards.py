"""Один профиль не заявляется в одну дисциплину дважды.

Индекс частичный: заявка вручную (без профиля) не обязана быть уникальной по
имени — полные тёзки возможны, и схема не вправе их запрещать.
"""

import asyncio
from datetime import date
from io import BytesIO

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.core.idempotency import remembered_response
from app.main import app
from app.models.base import Base
from app.models.idempotency import IdempotencyKey
from app.modules.tournaments.services.participant_import import IMPORT_COLUMNS, SHEET_ENTRIES

EVENT_YEAR = 2026
START_DATE = date(EVENT_YEAR, 5, 16).isoformat()
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


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


# ------------------------------------------------------ idempotency key


def sheet_of(rows: list[dict]) -> bytes:
    """Build an .xlsx the way an organizer would, from the real headers."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_ENTRIES
    sheet.append([column.header_ru for column in IMPORT_COLUMNS])
    for row in rows:
        sheet.append([row.get(column.key, "") for column in IMPORT_COLUMNS])
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def preview(client, tournament_id: str, payload: bytes, headers: dict[str, str]):
    return client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/preview",
        files={"file": ("entries.xlsx", payload, XLSX)},
        headers=headers,
    )


def participants(client, tournament_id: str) -> list[dict]:
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    everyone: list[dict] = []
    for competition in competitions:
        everyone += client.get(f"/api/v1/competitions/{competition['id']}/participants").json()
    return everyone


def test_the_same_commit_sent_twice_enters_people_once():
    """Двойной клик по «Завести» — не второй заход, а тот же самый."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    payload = sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])
    report = preview(client, tournament_id, payload, headers).json()

    key = {"Idempotency-Key": "11111111-1111-1111-1111-111111111111", **headers}
    first = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=key,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=key,
    )
    assert second.status_code == 200, second.text
    assert second.json() == first.json(), "повтор обязан вернуть прежний ответ"

    assert len(participants(client, tournament_id)) == 1


def test_a_commit_without_a_key_still_works():
    """Ключ необязателен: старый клиент не должен сломаться."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    payload = sheet_of([{"full_name": "Пётр Петров", "category": "Абсолютная мужская"}])
    report = preview(client, tournament_id, payload, headers).json()

    committed = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=headers,
    )
    assert committed.status_code == 200, committed.text
    assert len(participants(client, tournament_id)) == 1


def test_a_rejected_batch_does_not_burn_the_key_for_the_corrected_retry():
    """A 400 must not lock the key: the organizer fixes the bad row and resends it.

    If the claim from the failed attempt survived, the corrected retry would
    find the key already occupied and get refused too — a заявка stuck for good
    reason (bad data) turning into one stuck for no reason at all.
    """
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    payload = sheet_of(
        [
            {"full_name": "Хороший", "category": "Абсолютная мужская"},
            {"full_name": "Плохой", "category": "Женская абсолютка"},
        ]
    )
    report = preview(client, tournament_id, payload, headers).json()

    key = {"Idempotency-Key": "33333333-3333-3333-3333-333333333333", **headers}
    rejected = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=key,
    )
    assert rejected.status_code == 400, rejected.text
    assert participants(client, tournament_id) == []

    good_row = next(row for row in report["rows"] if row["full_name"] == "Хороший")
    retried = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": [good_row]},
        headers=key,
    )
    assert retried.status_code == 200, retried.text
    assert len(participants(client, tournament_id)) == 1


def test_a_claimed_key_with_a_stored_answer_is_returned_not_409():
    """The concurrent-repeat case: by the time a second request's claim insert
    unblocks and collides, the row it collided with may already hold the first
    request's answer — that answer must come back, not a 409 telling the
    organizer to wait for a request that has already finished.
    """
    setup_app_for_tests()

    async def scenario() -> dict:
        async with database_module.AsyncSessionLocal() as session:
            session.add(
                IdempotencyKey(
                    key="seeded-key",
                    endpoint="POST /example",
                    response={"created": 3},
                )
            )
            await session.commit()

        async with database_module.AsyncSessionLocal() as session:
            return await remembered_response(session, "seeded-key", "POST /example")

    assert asyncio.run(scenario()) == {"created": 3}


def test_a_claim_row_still_without_an_answer_answers_409():
    """A row with no stored answer, seen without hitting an IntegrityError,
    means the first request is genuinely still running — that is the one case
    409 exists for.
    """
    setup_app_for_tests()

    async def scenario() -> int:
        async with database_module.AsyncSessionLocal() as session:
            session.add(
                IdempotencyKey(key="in-flight-key", endpoint="POST /example", response=None)
            )
            await session.commit()

        async with database_module.AsyncSessionLocal() as session:
            with pytest.raises(HTTPException) as exc_info:
                await remembered_response(session, "in-flight-key", "POST /example")
            return exc_info.value.status_code

    assert asyncio.run(scenario()) == 409


def test_an_oversized_idempotency_key_is_refused_not_500():
    """A header longer than the column's String(128) must be a clean 4xx —
    on Postgres, letting it through to the insert raises StringDataRightTruncation.
    """
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    payload = sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])
    report = preview(client, tournament_id, payload, headers).json()

    key = {"Idempotency-Key": "x" * 129, **headers}
    response = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=key,
    )
    assert 400 <= response.status_code < 500, response.text
