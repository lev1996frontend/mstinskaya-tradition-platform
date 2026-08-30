"""Bracket generation: byes, the city constraint, and who may generate.

Setup follows the convention of the other API tests: an in-memory
``sqlite+aiosqlite`` engine swapped into ``app.core.database`` and driven
through ``TestClient``. No Postgres, no Docker.
"""

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base


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


def register_organizer(client, email: str = "organizer@example.com") -> tuple[str, dict[str, str]]:
    """Register a user and return their id plus an Authorization header.

    The organizer of a tournament may always run it, so no role seeding is
    needed for the ordinary path.
    """
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Ivan", "last_name": "Organizer"},
    )
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"], headers


def bootstrap(client, entrants: list[tuple[str, str]], *, competition_format="SINGLE_ELIMINATION"):
    """Create a tournament + competition and enter ``(name, city)`` pairs."""
    organizer_id, headers = register_organizer(client)

    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    assert ruleset.status_code == 201, ruleset.text

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Открытый турнир",
            "status": "REGISTRATION",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    competition = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={
            "tournament_id": tournament_id,
            "name": "Мужчины, оружие",
            "type": "INDIVIDUAL",
            "format": competition_format,
            "status": "REGISTRATION",
        },
    )
    assert competition.status_code == 201, competition.text
    competition_id = competition.json()["id"]

    participant_ids = []
    for name, city in entrants:
        response = client.post(
            f"/api/v1/competitions/{competition_id}/participants",
            json={"competition_id": competition_id, "display_name": name, "city": city},
        )
        assert response.status_code == 201, response.text
        participant_ids.append(response.json()["id"])

    return tournament_id, competition_id, participant_ids, headers


def generate(client, competition_id: str, headers: dict[str, str], **body):
    return client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json=body, headers=headers
    )


def first_round_pairs(bracket_body: dict) -> list[dict]:
    rounds = sorted(bracket_body["rounds"], key=lambda r: r["order"])
    return rounds[0]["matches"]


# --------------------------------------------------------------- scenario 1


def test_four_participants_four_cities_gives_a_clean_bracket():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(
        client,
        [
            ("Иванов", "Великий Новгород"),
            ("Петров", "Псков"),
            ("Сидоров", "Тверь"),
            ("Кузнецов", "Москва"),
        ],
    )

    response = generate(client, competition_id, headers)
    assert response.status_code == 201, response.text
    plan = response.json()

    assert plan["bracket_size"] == 4
    assert plan["participant_count"] == 4
    assert plan["bye_count"] == 0
    assert plan["round_count"] == 2
    assert plan["city_constraint_satisfied"] is True
    assert plan["unavoidable_collisions"] == []
    assert all(pair["is_bye"] is False for pair in plan["first_round"])

    bracket = client.get(f"/api/v1/competitions/{competition_id}/bracket")
    assert bracket.status_code == 200, bracket.text
    keys = [r["key"] for r in sorted(bracket.json()["rounds"], key=lambda r: r["order"])]
    assert keys == ["SEMIFINAL", "FINAL"]

    semis = first_round_pairs(bracket.json())
    assert len(semis) == 2
    # Both semifinals are seated and waiting for their lot; the final is not.
    assert all(m["status"] == "READY_FOR_LOT" for m in semis)
    assert all(m["is_bye"] is False for m in semis)
    for match in semis:
        assert match["participant_a"]["city"] != match["participant_b"]["city"]


# --------------------------------------------------------------- scenario 2


def test_eight_participants_avoid_same_city_first_round_pairs():
    client = setup_app_for_tests()
    # Four cities, two entrants each — always separable inside four pairs.
    entrants = [
        ("A1", "Новгород"),
        ("A2", "Новгород"),
        ("B1", "Псков"),
        ("B2", "Псков"),
        ("C1", "Тверь"),
        ("C2", "Тверь"),
        ("D1", "Москва"),
        ("D2", "Москва"),
    ]
    _, competition_id, _, headers = bootstrap(client, entrants)

    response = generate(client, competition_id, headers)
    assert response.status_code == 201, response.text
    plan = response.json()

    assert plan["bracket_size"] == 8
    assert plan["bye_count"] == 0
    assert plan["city_constraint_satisfied"] is True, plan["unavoidable_collisions"]

    for pair in plan["first_round"]:
        assert pair["participant_a_city"] != pair["participant_b_city"]


# --------------------------------------------------------------- scenario 3


def test_ten_participants_produce_a_sixteen_bracket_with_marked_byes():
    client = setup_app_for_tests()
    entrants = [(f"Боец{i}", f"Город{i}") for i in range(10)]
    _, competition_id, _, headers = bootstrap(client, entrants)

    response = generate(client, competition_id, headers)
    assert response.status_code == 201, response.text
    plan = response.json()

    assert plan["bracket_size"] == 16
    assert plan["participant_count"] == 10
    assert plan["bye_count"] == 6
    assert plan["round_count"] == 4
    assert sum(1 for pair in plan["first_round"] if pair["is_bye"]) == 6

    bracket = client.get(f"/api/v1/competitions/{competition_id}/bracket").json()
    keys = [r["key"] for r in sorted(bracket["rounds"], key=lambda r: r["order"])]
    assert keys == ["ROUND_OF_16", "QUARTERFINAL", "SEMIFINAL", "FINAL"]

    round_of_16 = first_round_pairs(bracket)
    assert len(round_of_16) == 8
    byes = [m for m in round_of_16 if m["is_bye"]]
    assert len(byes) == 6
    for match in byes:
        # A bye is explicit: flagged, already decided, one side empty.
        assert match["status"] == "FINISHED"
        assert match["winner_id"] is not None
        assert (match["participant_a"] is None) != (match["participant_b"] is None)

    # …and its fighter is already seated in the quarterfinal, from the backend.
    quarters = sorted(bracket["rounds"], key=lambda r: r["order"])[1]["matches"]
    seated = sum(
        1 for m in quarters for slot in (m["participant_a"], m["participant_b"]) if slot is not None
    )
    assert seated == 6

    # A bye is not a played bout, so it never shows up as a win in the tally.
    standings = client.get(f"/api/v1/competitions/{competition_id}/standings").json()
    assert all(row["wins"] == 0 for row in standings["rows"])


# --------------------------------------------------------------- scenario 4


def test_sixteen_participants_give_a_full_bracket_without_byes():
    client = setup_app_for_tests()
    entrants = [(f"Боец{i}", f"Город{i % 8}") for i in range(16)]
    _, competition_id, _, headers = bootstrap(client, entrants)

    response = generate(client, competition_id, headers)
    assert response.status_code == 201, response.text
    plan = response.json()

    assert plan["bracket_size"] == 16
    assert plan["bye_count"] == 0
    assert len(plan["first_round"]) == 8
    assert all(pair["is_bye"] is False for pair in plan["first_round"])
    # Eight cities across sixteen entrants fits comfortably in eight pairs.
    assert plan["city_constraint_satisfied"] is True, plan["unavoidable_collisions"]

    bracket = client.get(f"/api/v1/competitions/{competition_id}/bracket").json()
    counts = [len(r["matches"]) for r in sorted(bracket["rounds"], key=lambda r: r["order"])]
    assert counts == [8, 4, 2, 1]


# --------------------------------------------------------------- scenario 5


def test_impossible_city_distribution_still_produces_a_complete_bracket():
    client = setup_app_for_tests()
    # Five of eight entrants share a city: only four first-round pairs exist, so
    # at least one same-city meeting is unavoidable by pigeonhole.
    entrants = [
        ("N1", "Новгород"),
        ("N2", "Новгород"),
        ("N3", "Новгород"),
        ("N4", "Новгород"),
        ("N5", "Новгород"),
        ("P1", "Псков"),
        ("T1", "Тверь"),
        ("M1", "Москва"),
    ]
    _, competition_id, _, headers = bootstrap(client, entrants)

    response = generate(client, competition_id, headers)
    assert response.status_code == 201, response.text
    plan = response.json()

    # It terminated, and it produced a valid, complete bracket.
    assert plan["bracket_size"] == 8
    assert plan["bye_count"] == 0
    assert len(plan["first_round"]) == 4

    # It did not claim success it could not achieve.
    assert plan["city_constraint_satisfied"] is False
    assert len(plan["unavoidable_collisions"]) >= 1
    for collision in plan["unavoidable_collisions"]:
        assert collision["city"] == "Новгород"
        assert collision["participant_a_id"] != collision["participant_b_id"]
        assert collision["participant_a_name"] and collision["participant_b_name"]

    # Every entrant is seated exactly once, collisions notwithstanding.
    seated = [
        pid
        for pair in plan["first_round"]
        for pid in (pair["participant_a_id"], pair["participant_b_id"])
        if pid
    ]
    assert len(seated) == 8
    assert len(set(seated)) == 8

    bracket = client.get(f"/api/v1/competitions/{competition_id}/bracket").json()
    counts = [len(r["matches"]) for r in sorted(bracket["rounds"], key=lambda r: r["order"])]
    assert counts == [4, 2, 1]

    # The warning is on record in the journal, not only in the HTTP response.
    events = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    generated = [e for e in events if e["event_type"] == "BRACKET_GENERATED"]
    assert len(generated) == 1
    assert generated[0]["payload"]["city_constraint_satisfied"] is False


def test_preview_does_not_write_anything():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(
        client, [("A", "Тверь"), ("B", "Псков"), ("C", "Москва"), ("D", "Новгород")]
    )

    preview = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/preview", headers=headers
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["bracket_size"] == 4

    assert client.get(f"/api/v1/competitions/{competition_id}/matches").json() == []


def test_regenerating_an_existing_bracket_is_refused():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(
        client, [("A", "Тверь"), ("B", "Псков"), ("C", "Москва"), ("D", "Новгород")]
    )
    assert generate(client, competition_id, headers).status_code == 201
    assert generate(client, competition_id, headers).status_code == 409


# ------------------------------------------------------------ authorization


def test_bracket_generation_requires_an_authorized_manager():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(
        client, [("A", "Тверь"), ("B", "Псков"), ("C", "Москва"), ("D", "Новгород")]
    )

    anonymous = client.post(f"/api/v1/competitions/{competition_id}/bracket/generate", json={})
    assert anonymous.status_code == 401, anonymous.text

    # A signed-in user who is neither the organizer nor an instructor.
    _, stranger_headers = register_organizer(client, email="stranger@example.com")
    forbidden = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json={}, headers=stranger_headers
    )
    assert forbidden.status_code == 403, forbidden.text

    assert generate(client, competition_id, headers).status_code == 201


def test_an_instructor_may_run_someone_elses_tournament():
    """The INSTRUCTOR role is expressible with identity's existing Role model.

    ``Role`` is a generic ``code``/``name`` pair, so granting it needs no change
    to the identity module — which ``docs/clubs-domain.md`` forbids.
    """
    from sqlalchemy import select

    from app.modules.identity.models import Role, User, UserRole

    client = setup_app_for_tests()
    _, competition_id, _, _ = bootstrap(
        client, [("A", "Тверь"), ("B", "Псков"), ("C", "Москва"), ("D", "Новгород")]
    )
    instructor_id, instructor_headers = register_organizer(client, email="instructor@example.com")

    async def grant_instructor_role() -> None:
        async with database_module.AsyncSessionLocal() as session:
            role = await session.scalar(select(Role).where(Role.code == "INSTRUCTOR"))
            if role is None:
                role = Role(code="INSTRUCTOR", name="Инструктор")
                session.add(role)
                await session.flush()
            user = await session.scalar(select(User).where(User.email == "instructor@example.com"))
            session.add(UserRole(user_id=user.id, role_id=role.id))
            await session.commit()

    asyncio.run(grant_instructor_role())

    response = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json={}, headers=instructor_headers
    )
    assert response.status_code == 201, response.text
    assert instructor_id is not None
