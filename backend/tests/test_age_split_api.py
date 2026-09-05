"""Cutting a children's category into age streams.

Eight-year-olds and fourteen-year-olds enter the same «Абсолютная детская», and
they cannot be drawn as one field. The organizer states the largest age gap a
bracket may hold; the streams follow from that number and the entrants who
actually turned up.
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
    return client.get("/api/v1/users/me", headers=headers).json()["id"], headers


def bootstrap(client, ages: list[int], *, max_age_gap: int | None = 2, max_age: int | None = 14):
    """«Абсолютная детская» holding entrants of the given ages."""
    organizer_id, headers = register(client, "organizer@example.com")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Открытый турнир",
            "status": "REGISTRATION",
            "start_date": START_DATE,
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    tournament_id = tournament.json()["id"]

    body = {
        "tournament_id": tournament_id,
        "name": "Абсолютная детская",
        "type": "INDIVIDUAL",
        "format": "SINGLE_ELIMINATION",
        "status": "REGISTRATION",
    }
    if max_age is not None:
        body["max_age"] = max_age
    if max_age_gap is not None:
        body["max_age_gap"] = max_age_gap
    created = client.post(f"/api/v1/tournaments/{tournament_id}/competitions", json=body)
    assert created.status_code == 201, created.text
    competition_id = created.json()["id"]

    ids = {}
    for age in ages:
        name = f"Боец{age}"
        entered = client.post(
            f"/api/v1/competitions/{competition_id}/participants",
            json={
                "competition_id": competition_id,
                "display_name": name,
                "birth_year": EVENT_YEAR - age,
            },
        )
        assert entered.status_code == 201, entered.text
        ids[age] = entered.json()["id"]
    return tournament_id, competition_id, ids, headers


def split_preview(client, competition_id) -> dict:
    response = client.get(f"/api/v1/competitions/{competition_id}/age-split")
    assert response.status_code == 200, response.text
    return response.json()


def competitions(client, tournament_id) -> list[dict]:
    return client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()


# ---------------------------------------------------------------- preview


def test_the_streams_follow_from_the_gap_and_the_entrants():
    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(client, [8, 9, 11, 12, 13, 14], max_age_gap=2)

    state = split_preview(client, competition_id)
    assert state["age_min"] == 8
    assert state["age_max"] == 14
    assert state["age_spread"] == 6
    assert state["split_needed"] is True
    assert state["ready"] is True
    # 11 to 13 is exactly two years, so they fight together and 14 is alone.
    assert [band["label"] for band in state["bands"]] == ["8–9", "11–13", "14"]
    assert [band["name"] for band in state["bands"]] == [
        "Абсолютная детская 8–9",
        "Абсолютная детская 11–13",
        "Абсолютная детская 14",
    ]


def test_a_wider_gap_makes_fewer_streams():
    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(client, [8, 9, 11, 12, 13, 14], max_age_gap=3)
    assert [b["label"] for b in split_preview(client, competition_id)["bands"]] == ["8–11", "12–14"]


def test_a_field_that_already_fits_is_not_split():
    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(client, [12, 13, 14], max_age_gap=2)

    state = split_preview(client, competition_id)
    assert state["split_needed"] is False
    assert state["ready"] is False
    assert [b["label"] for b in state["bands"]] == ["12–14"]


def test_the_preview_writes_nothing():
    client = setup_app_for_tests()
    tournament_id, competition_id, _, _ = bootstrap(client, [8, 12, 14])
    split_preview(client, competition_id)
    assert [c["name"] for c in competitions(client, tournament_id)] == ["Абсолютная детская"]


def test_a_lonely_stream_is_flagged_not_folded_away():
    """Merging the eight-year-old upward is what the gap exists to prevent."""
    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(client, [8, 12, 13], max_age_gap=2)

    bands = split_preview(client, competition_id)["bands"]
    assert [b["label"] for b in bands] == ["8", "12–13"]
    assert bands[0]["is_lonely"] is True
    assert bands[1]["is_lonely"] is False


def test_the_preview_is_public():
    """Which children fight whom is not a secret."""
    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(client, [8, 12, 14])
    assert client.get(f"/api/v1/competitions/{competition_id}/age-split").status_code == 200


# ---------------------------------------------------------------- blockers


def test_a_discipline_with_no_gap_set_is_never_split():
    """Every adult category, and this must stay exactly as it was."""
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(client, [20, 30, 45], max_age_gap=None, max_age=None)

    state = split_preview(client, competition_id)
    assert "NO_AGE_GAP" in {b["code"] for b in state["blockers"]}
    assert state["ready"] is False
    refused = client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers)
    assert refused.status_code == 409, refused.text


def test_a_missing_birth_year_blocks_the_split():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(client, [8, 12, 14], max_age_gap=2, max_age=None)
    client.post(
        f"/api/v1/competitions/{competition_id}/participants",
        json={"competition_id": competition_id, "display_name": "Без года"},
    ).raise_for_status()

    state = split_preview(client, competition_id)
    assert "MISSING_BIRTH_YEAR" in {b["code"] for b in state["blockers"]}
    assert client.post(
        f"/api/v1/competitions/{competition_id}/age-split", headers=headers
    ).status_code == 409


def test_a_started_discipline_cannot_be_split():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(client, [8, 9, 13, 14], max_age_gap=2)
    client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json={}, headers=headers
    ).raise_for_status()

    state = split_preview(client, competition_id)
    assert "ALREADY_STARTED" in {b["code"] for b in state["blockers"]}
    assert client.post(
        f"/api/v1/competitions/{competition_id}/age-split", headers=headers
    ).status_code == 409


def test_splitting_a_field_that_fits_is_refused():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(client, [12, 13, 14], max_age_gap=2)
    refused = client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers)
    assert refused.status_code == 400, refused.text


# ------------------------------------------------------------------- apply


def test_the_split_turns_streams_into_real_disciplines():
    client = setup_app_for_tests()
    tournament_id, competition_id, ids, headers = bootstrap(
        client, [8, 9, 11, 12, 13, 14], max_age_gap=2
    )

    applied = client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers)
    assert applied.status_code == 201, applied.text
    body = applied.json()
    assert body["source_name"] == "Абсолютная детская"
    assert [c["label"] for c in body["competitions"]] == ["8–9", "11–13", "14"]

    # The competition that was split keeps its id and becomes the youngest
    # stream, so any link already handed out still resolves.
    assert body["competitions"][0]["competition_id"] == competition_id

    rows = {c["name"]: c for c in competitions(client, tournament_id)}
    assert set(rows) == {
        "Абсолютная детская 8–9",
        "Абсолютная детская 11–13",
        "Абсолютная детская 14",
    }
    assert rows["Абсолютная детская 8–9"]["participant_count"] == 2
    assert rows["Абсолютная детская 11–13"]["participant_count"] == 3
    assert rows["Абсолютная детская 14"]["participant_count"] == 1
    # Each stream carries its own bounds, so a late entry lands in the right one.
    assert rows["Абсолютная детская 11–13"]["age_label"] == "11–13 лет"


def test_every_entrant_lands_in_exactly_one_stream():
    client = setup_app_for_tests()
    tournament_id, competition_id, ids, headers = bootstrap(
        client, [8, 9, 11, 12, 13, 14], max_age_gap=2
    )
    client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers).raise_for_status()

    seen: list[str] = []
    for competition in competitions(client, tournament_id):
        seen += [
            p["id"]
            for p in client.get(f"/api/v1/competitions/{competition['id']}/participants").json()
        ]
    assert sorted(seen) == sorted(ids.values())


def test_each_stream_then_runs_as_an_ordinary_discipline():
    """Nothing downstream has to learn what a stream is."""
    client = setup_app_for_tests()
    tournament_id, competition_id, _, headers = bootstrap(
        client, [8, 9, 13, 14], max_age_gap=2
    )
    client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers).raise_for_status()

    for competition in competitions(client, tournament_id):
        built = client.post(
            f"/api/v1/competitions/{competition['id']}/bracket/generate", json={}, headers=headers
        )
        assert built.status_code == 201, built.text
        assert built.json()["participant_count"] == 2


def test_the_split_is_journalled_with_its_reason():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(client, [8, 9, 13, 14], max_age_gap=2)
    client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers).raise_for_status()

    journal = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    split = [e for e in journal if e["event_type"] == "AGE_BANDS_SPLIT"]
    assert len(split) == 1
    assert split[0]["payload"]["max_age_gap"] == 2
    assert split[0]["payload"]["bands"] == ["8–9", "13–14"]
    assert split[0]["payload"]["source_name"] == "Абсолютная детская"


def test_splitting_twice_is_refused():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(client, [8, 9, 13, 14], max_age_gap=2)
    client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers).raise_for_status()

    again = client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=headers)
    # The stream left behind holds one age, so there is nothing left to cut.
    assert again.status_code == 400, again.text


def test_the_split_requires_an_authorized_manager():
    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(client, [8, 12, 14])

    anonymous = client.post(f"/api/v1/competitions/{competition_id}/age-split")
    assert anonymous.status_code == 401, anonymous.text

    _, stranger = register(client, "stranger@example.com")
    forbidden = client.post(f"/api/v1/competitions/{competition_id}/age-split", headers=stranger)
    assert forbidden.status_code == 403, forbidden.text
