"""Categories as separate disciplines, and the age bounds some of them carry.

Two things are pinned down here.

A tournament holds several disciplines — «Абсолютная детская», «Абсолютная
взрослая», «Абсолютная ветеранская» — each with its own field, bracket and champion. An entry
now inherits the category of the discipline it is entered in, instead of being
stamped with whichever category of the tournament happened to be created first.

Age bounds live on the discipline and are independently optional. The headline
case is that they compose: a fifty-year-old enters «Абсолютная ветеранская» (45+) *and* the
open adult absolute, because the open one sets no bound at all.
"""

import asyncio
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base

#: The tournament's start date fixes the year every age is measured against, so
#: these tests do not drift as the real calendar moves.
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


def register_organizer(client, email: str = "organizer@example.com") -> tuple[str, dict[str, str]]:
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор"},
    )
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"], headers


def make_tournament(client, email: str = "organizer@example.com") -> tuple[str, dict[str, str]]:
    organizer_id, headers = register_organizer(client, email)
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    assert ruleset.status_code == 201, ruleset.text
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
    return tournament.json()["id"], headers


def make_category(client, tournament_id: str, name: str) -> str:
    response = client.post(
        f"/api/v1/tournaments/{tournament_id}/categories",
        json={"tournament_id": tournament_id, "name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def make_competition(client, tournament_id: str, name: str, **extra) -> str:
    response = client.post(
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
    assert response.status_code == 201, response.text
    return response.json()["id"]


def enter(client, competition_id: str, name: str, **extra):
    return client.post(
        f"/api/v1/competitions/{competition_id}/participants",
        json={"competition_id": competition_id, "display_name": name, **extra},
    )


# ------------------------------------------------- several disciplines


def test_a_tournament_holds_several_disciplines_each_with_its_own_field():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)

    children = make_category(client, tournament_id, "Абсолютная детская")
    adults = make_category(client, tournament_id, "Абсолютная мужская")

    child_competition = make_competition(
        client, tournament_id, "Абсолютная детская", category_id=children, max_age=14
    )
    adult_competition = make_competition(
        client, tournament_id, "Абсолютная мужская", category_id=adults
    )

    assert enter(client, child_competition, "Малой", birth_year=2014).status_code == 201
    assert enter(client, adult_competition, "Иван", birth_year=1996).status_code == 201

    listed = client.get(f"/api/v1/tournaments/{tournament_id}/competitions")
    assert listed.status_code == 200, listed.text
    by_name = {row["name"]: row for row in listed.json()}
    assert by_name["Абсолютная детская"]["participant_count"] == 1
    assert by_name["Абсолютная мужская"]["participant_count"] == 1
    assert by_name["Абсолютная детская"]["category_id"] == children
    assert by_name["Абсолютная мужская"]["category_id"] == adults


def test_an_entry_inherits_the_category_of_its_own_discipline():
    """The bug this closes: everyone used to get the tournament's *first* category."""
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)

    first = make_category(client, tournament_id, "Абсолютная детская")
    second = make_category(client, tournament_id, "Абсолютная ветеранская")
    veterans = make_competition(client, tournament_id, "Абсолютная ветеранская", category_id=second, min_age=45)

    entered = enter(client, veterans, "Старшой", birth_year=1970)
    assert entered.status_code == 201, entered.text

    participants = client.get(f"/api/v1/competitions/{veterans}/participants")
    assert participants.status_code == 200, participants.text
    # Not `first`, which is what the old "oldest category" lookup would give.
    assert participants.json()[0]["id"] == entered.json()["id"]
    assert entered.json()["competition_id"] == veterans
    assert first != second


def test_a_category_from_another_tournament_is_refused():
    client = setup_app_for_tests()
    first_tournament, _ = make_tournament(client)
    stray = make_category(client, first_tournament, "Чужая")

    other, _ = make_tournament(client, "second@example.com")
    response = client.post(
        f"/api/v1/tournaments/{other}/competitions",
        json={
            "tournament_id": other,
            "name": "Абсолютная",
            "type": "INDIVIDUAL",
            "format": "SINGLE_ELIMINATION",
            "status": "REGISTRATION",
            "category_id": stray,
        },
    )
    assert response.status_code == 404, response.text


# --------------------------------------------------------- age bounds


def test_an_unbounded_discipline_never_asks_for_a_birth_year():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    absolute = make_competition(client, tournament_id, "Абсолютная мужская")

    assert enter(client, absolute, "Безымянный год").status_code == 201


def test_a_veteran_may_enter_both_his_category_and_the_open_one():
    """The headline case: bounds are per-discipline, so they compose."""
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)

    veterans = make_competition(client, tournament_id, "Абсолютная ветеранская", min_age=45)
    absolute = make_competition(client, tournament_id, "Абсолютная мужская")

    born = EVENT_YEAR - 50
    assert enter(client, veterans, "Пётр Замятин", birth_year=born).status_code == 201
    assert enter(client, absolute, "Пётр Замятин", birth_year=born).status_code == 201


def test_someone_too_young_for_the_veterans_is_refused():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    veterans = make_competition(client, tournament_id, "Абсолютная ветеранская", min_age=45)

    refused = enter(client, veterans, "Молодой", birth_year=EVENT_YEAR - 30)
    assert refused.status_code == 400, refused.text
    assert refused.json()["detail"]["code"] == "AGE_BELOW_MINIMUM"


def test_someone_too_old_for_a_children_category_is_refused():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    children = make_competition(client, tournament_id, "Абсолютная детская", max_age=14)

    refused = enter(client, children, "Взрослый", birth_year=EVENT_YEAR - 25)
    assert refused.status_code == 400, refused.text
    assert refused.json()["detail"]["code"] == "AGE_ABOVE_MAXIMUM"


def test_the_bound_counts_the_year_of_the_event_not_the_day():
    """45 reached anywhere in the tournament's year is 45."""
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    veterans = make_competition(client, tournament_id, "Абсолютная ветеранская", min_age=45)

    # Turns exactly 45 during EVENT_YEAR, possibly after the May start date.
    assert enter(client, veterans, "Ровно 45", birth_year=EVENT_YEAR - 45).status_code == 201
    assert enter(client, veterans, "Ещё 44", birth_year=EVENT_YEAR - 44).status_code == 400


def test_a_bounded_discipline_refuses_an_entry_with_no_year():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    veterans = make_competition(client, tournament_id, "Абсолютная ветеранская", min_age=45)

    refused = enter(client, veterans, "Без года")
    assert refused.status_code == 400, refused.text
    assert refused.json()["detail"]["code"] == "MISSING_BIRTH_YEAR"


def test_the_organizer_may_admit_someone_anyway_and_it_is_recorded():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    veterans = make_competition(client, tournament_id, "Абсолютная ветеранская", min_age=45)

    admitted = enter(
        client,
        veterans,
        "Почти 45",
        birth_year=EVENT_YEAR - 44,
        age_override_reason="Исполняется 45 через месяц, допущен решением коллегии",
    )
    assert admitted.status_code == 201, admitted.text

    journal = client.get(f"/api/v1/competitions/{veterans}/events")
    assert journal.status_code == 200, journal.text
    overrides = [e for e in journal.json() if e["event_type"] == "AGE_LIMIT_OVERRIDDEN"]
    assert len(overrides) == 1
    assert overrides[0]["payload"]["code"] == "AGE_BELOW_MINIMUM"
    assert overrides[0]["description"].startswith("Исполняется 45")


def test_bounds_are_reported_with_a_ready_made_label():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    make_competition(client, tournament_id, "Абсолютная ветеранская", min_age=45)
    make_competition(client, tournament_id, "Абсолютная детская", max_age=14)
    make_competition(client, tournament_id, "Абсолютная мужская")

    rows = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    labels = {row["name"]: row["age_label"] for row in rows}
    assert labels == {
        "Абсолютная ветеранская": "45+",
        "Абсолютная детская": "до 14 лет",
        "Абсолютная мужская": None,
    }


def test_inverted_bounds_are_refused():
    client = setup_app_for_tests()
    tournament_id, _ = make_tournament(client)
    response = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={
            "tournament_id": tournament_id,
            "name": "Ерунда",
            "type": "INDIVIDUAL",
            "format": "SINGLE_ELIMINATION",
            "status": "REGISTRATION",
            "min_age": 40,
            "max_age": 20,
        },
    )
    assert response.status_code == 400, response.text
