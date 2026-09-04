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


def test_tournament_foundation_flow():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "organizer@example.com",
            "password": "StrongPassword123!",
            "first_name": "Tournament",
            "last_name": "Organizer",
        },
    )
    assert register_response.status_code == 201, register_response.text
    organizer_token = register_response.json()["access_token"]
    organizer_me = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {organizer_token}"},
    )
    assert organizer_me.status_code == 200, organizer_me.text
    organizer_id = organizer_me.json()["id"]

    user2 = client.post(
        "/api/v1/auth/register",
        json={
            "email": "judge2@example.com",
            "password": "StrongPassword123!",
            "first_name": "Second",
            "last_name": "Judge",
        },
    )
    assert user2.status_code == 201, user2.text
    judge_token = user2.json()["access_token"]
    judge_me = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {judge_token}"},
    )
    assert judge_me.status_code == 200, judge_me.text
    judge_id = judge_me.json()["id"]

    athlete1 = client.post(
        "/api/v1/athletes",
        json={
            "user_id": organizer_id,
            "nickname": "RedFighter",
            "experience_years": 3,
            "level": "PRACTITIONER",
        },
    )
    assert athlete1.status_code == 201, athlete1.text
    athlete1_id = athlete1.json()["id"]

    athlete2 = client.post(
        "/api/v1/athletes",
        json={
            "user_id": judge_id,
            "nickname": "BlueFighter",
            "experience_years": 4,
            "level": "PRACTITIONER",
        },
    )
    assert athlete2.status_code == 201, athlete2.text
    athlete2_id = athlete2.json()["id"]

    ruleset = client.post(
        "/api/v1/rulesets",
        json={
            "title": "Mstina Championship Rules",
            "description": "Tournament rules",
            "version": "2026.2",
            "status": "ACTIVE",
        },
    )
    assert ruleset.status_code == 201, ruleset.text
    ruleset_id = ruleset.json()["id"]

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "City Open 2026",
            "description": "Regional tournament",
            "status": "REGISTRATION",
            "start_date": "2026-09-10T10:00:00Z",
            "end_date": "2026-09-12T18:00:00Z",
            "location": "Arena Hall",
            "city": "Minsk",
            "country": "Belarus",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset_id,
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    category = client.post(
        f"/api/v1/tournaments/{tournament_id}/categories",
        json={
            "name": "Lightweight",
            "description": "Under 70 kg",
        },
    )
    assert category.status_code == 201, category.text
    category_id = category.json()["id"]

    participant_red = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants",
        json={
            "category_id": category_id,
            "athlete_id": athlete1_id,
            "status": "APPROVED",
        },
    )
    assert participant_red.status_code == 201, participant_red.text
    participant_red_id = participant_red.json()["id"]

    participant_blue = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants",
        json={
            "category_id": category_id,
            "athlete_id": athlete2_id,
            "status": "APPROVED",
        },
    )
    assert participant_blue.status_code == 201, participant_blue.text
    participant_blue_id = participant_blue.json()["id"]

    match = client.post(
        f"/api/v1/tournaments/{tournament_id}/matches",
        json={
            "category_id": category_id,
            "participant_red_id": participant_red_id,
            "participant_blue_id": participant_blue_id,
            "status": "SCHEDULED",
        },
    )
    assert match.status_code == 201, match.text
    match_id = match.json()["id"]

    assignment = client.post(
        f"/api/v1/tournaments/matches/{match_id}/judges",
        json={
            "judge_id": judge_id,
            "role": "MAIN",
        },
    )
    assert assignment.status_code == 201, assignment.text
    assert assignment.json()["role"] == "MAIN"

    decision = client.post(
        f"/api/v1/tournaments/matches/{match_id}/decisions",
        json={
            "decision_type": "VICTORY",
            "winner_id": participant_red_id,
            "comment": "Clear tactical win",
        },
    )
    assert decision.status_code == 201, decision.text
    assert decision.json()["winner_id"] == participant_red_id

    document = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={
            "title": "Tournament rules",
            "file_url": "https://example.com/rules.pdf",
            "type": "RULES",
        },
    )
    assert document.status_code == 201, document.text
    assert document.json()["type"] == "RULES"

    app.dependency_overrides.clear()


def test_tournament_entry_list_excludes_competition_entrants():
    """The tournament's entry list is the tournament's own, not its disciplines'.

    Entries and competition entrants share one table, so the list has to filter
    on ``competition_id``; without it the same fighter was counted once as an
    entry and once more for every discipline they had been drawn into.
    """
    client = setup_app_for_tests()

    organizer = client.post(
        "/api/v1/auth/register",
        json={
            "email": "entry-list@example.com",
            "password": "StrongPassword123!",
            "first_name": "Entry",
            "last_name": "Organizer",
        },
    )
    assert organizer.status_code == 201, organizer.text
    organizer_id = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {organizer.json()['access_token']}"},
    ).json()["id"]

    athlete = client.post(
        "/api/v1/athletes",
        json={
            "user_id": organizer_id,
            "nickname": "OnlyFighter",
            "experience_years": 1,
            "level": "PRACTITIONER",
        },
    )
    assert athlete.status_code == 201, athlete.text
    athlete_id = athlete.json()["id"]

    ruleset = client.post(
        "/api/v1/rulesets",
        json={"title": "Entry list rules", "version": "1.0", "status": "ACTIVE"},
    )
    assert ruleset.status_code == 201, ruleset.text

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Entry List Open",
            "status": "REGISTRATION",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    category = client.post(f"/api/v1/tournaments/{tournament_id}/categories", json={"name": "Stick"})
    assert category.status_code == 201, category.text

    entry = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants",
        json={"category_id": category.json()["id"], "athlete_id": athlete_id, "status": "APPROVED"},
    )
    assert entry.status_code == 201, entry.text
    entry_id = entry.json()["id"]

    competition = client.post(
        "/api/v1/competitions",
        json={
            "tournament_id": tournament_id,
            "name": "Stick individual",
            "type": "INDIVIDUAL",
            "format": "SINGLE_ELIMINATION",
        },
    )
    assert competition.status_code == 201, competition.text
    competition_id = competition.json()["id"]

    entrant = client.post(
        f"/api/v1/competitions/{competition_id}/participants",
        json={"competition_id": competition_id, "athlete_id": athlete_id, "type": "ATHLETE", "seed": 1},
    )
    assert entrant.status_code == 201, entrant.text

    listed = client.get(f"/api/v1/tournaments/{tournament_id}/participants")
    assert listed.status_code == 200, listed.text
    assert [p["id"] for p in listed.json()] == [entry_id]

    # The entrant is still reachable where it belongs.
    in_competition = client.get(f"/api/v1/competitions/{competition_id}/participants")
    assert in_competition.status_code == 200, in_competition.text
    assert [p["id"] for p in in_competition.json()] == [entrant.json()["id"]]

    app.dependency_overrides.clear()
