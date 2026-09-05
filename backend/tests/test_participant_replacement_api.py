"""Putting a fighter in the place of one who pulled out.

The rule pinned down here is the same one withdrawal already obeys: the bracket
is never rebuilt. A replacement takes over the vacated *seat* — the same match
ids, the same numbering — and the fighter who left keeps their own row and their
own history. What changes is only which participant id sits in the bouts they
had not fought.

The window is deliberately narrow. A replacement is allowed only while the
departing fighter has fought nothing: the moment a real result exists, putting
someone else in their place would hand a newcomer a path they did not walk.

Setup follows the convention of the other API tests.
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


def register_user(client, email: str) -> tuple[str, dict[str, str]]:
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "first_name": "Иван",
            "last_name": "Судья",
        },
    )
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"], headers


def make_tournament(client) -> tuple[str, dict[str, str]]:
    organizer_id, headers = register_user(client, "organizer@example.com")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"}
    )
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
    return tournament.json()["id"], headers


def make_competition(client, tournament_id: str, name: str, **bounds) -> str:
    payload = {
        "tournament_id": tournament_id,
        "name": name,
        "type": "INDIVIDUAL",
        "format": "SINGLE_ELIMINATION",
        "status": "REGISTRATION",
    }
    payload.update(bounds)
    response = client.post(f"/api/v1/tournaments/{tournament_id}/competitions", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def enter(client, competition_id: str, name: str, **extra):
    payload = {"competition_id": competition_id, "display_name": name}
    payload.update(extra)
    return client.post(f"/api/v1/competitions/{competition_id}/participants", json=payload)


def entered(client, competition_id: str, name: str, **extra) -> str:
    response = enter(client, competition_id, name, **extra)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def matches(client, competition_id: str) -> list[dict]:
    response = client.get(f"/api/v1/competitions/{competition_id}/matches")
    assert response.status_code == 200, response.text
    return response.json()


def match_of(rows: list[dict], *participant_ids: str) -> dict:
    wanted = set(participant_ids)
    found = [
        row
        for row in rows
        if wanted <= {side["id"] for side in (row["participant_a"], row["participant_b"]) if side}
    ]
    assert len(found) == 1, f"expected one match for {wanted}, got {len(found)}"
    return found[0]


def status_of(client, competition_id: str, participant_id: str) -> str:
    response = client.get(f"/api/v1/competitions/{competition_id}/participants")
    assert response.status_code == 200, response.text
    for row in response.json():
        if row["id"] == participant_id:
            return row["status"]
    raise AssertionError(f"{participant_id} is not on the roster")


def events(client, competition_id: str) -> list[dict]:
    response = client.get(f"/api/v1/competitions/{competition_id}/events")
    assert response.status_code == 200, response.text
    return response.json()


def four_with_reserve(client):
    """Four seeded fighters and one reserve, bracket generated.

    Seeds make the draw deterministic, so the tests can name the exact bout a
    fighter sits in rather than searching for it.
    """
    tournament_id, headers = make_tournament(client)
    competition_id = make_competition(client, tournament_id, "Абсолютная мужская")
    ids = {}
    for index, (name, club) in enumerate(
        [
            ("Иван", "Мста"),
            ("Пётр", "Волхов"),
            ("Сергей", "Мста"),
            ("Фёдор", "Ильмень"),
        ],
        start=1,
    ):
        ids[name] = entered(client, competition_id, name, club_name=club, seed=index)
    ids["Запас"] = entered(client, competition_id, "Запас", club_name="Мста", status="RESERVE")

    generated = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json={}, headers=headers
    )
    assert generated.status_code == 201, generated.text
    return competition_id, ids, headers, generated.json()


# ------------------------------------------------------------ the reserve


def test_a_reserve_is_not_dealt_into_the_draw():
    """Someone held in reserve has not entered the competition yet."""
    client = setup_app_for_tests()
    _, _, _, plan = four_with_reserve(client)

    assert plan["participant_count"] == 4
    assert plan["bye_count"] == 0


# -------------------------------------------------------- the substitution


def test_the_replacement_takes_the_seat_and_no_walkover_is_granted():
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)
    bout = match_of(matches(client, competition_id), ids["Иван"], ids["Фёдор"])

    replaced = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert replaced.status_code == 200, replaced.text
    body = replaced.json()
    assert body["to_status"] == "WITHDRAWN"
    assert body["replacement"]["participant_id"] == ids["Запас"]
    # The opponent gets a fight, not a free pass.
    assert body["walkovers"] == []

    after = match_of(matches(client, competition_id), ids["Запас"], ids["Фёдор"])
    assert after["id"] == bout["id"], "the seat must be reused, not a new bout"
    assert after["status"] != "FINISHED"
    assert after["winner_id"] is None


def test_the_replacement_leaves_registration_and_the_departed_keeps_their_row():
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)

    client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )

    assert status_of(client, competition_id, ids["Запас"]) == "REGISTERED"
    assert status_of(client, competition_id, ids["Иван"]) == "WITHDRAWN"


def test_the_journal_names_both_fighters():
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)

    client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )

    replaced = [e for e in events(client, competition_id) if e["event_type"] == "PARTICIPANT_REPLACED"]
    assert len(replaced) == 1, replaced
    payload = replaced[0]["payload"]
    assert payload["participant_id"] == ids["Иван"]
    assert payload["replacement_participant_id"] == ids["Запас"]
    assert payload["reason"] == "Травма"


def test_a_fought_bout_blocks_the_replacement():
    """Once a real result exists the seat is no longer free to give away."""
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)
    bout = match_of(matches(client, competition_id), ids["Иван"], ids["Фёдор"])

    recorded = client.post(
        f"/api/v1/matches/{bout['id']}/result",
        json={"match_id": bout["id"], "winner_id": ids["Иван"], "method": "JUDGE_DECISION"},
    )
    assert recorded.status_code == 201, recorded.text

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["detail"]["code"] == "ALREADY_FOUGHT"


def test_a_started_bout_blocks_the_replacement():
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)
    bout = match_of(matches(client, competition_id), ids["Иван"], ids["Фёдор"])
    for side in ("RED", "BLUE"):
        drawn = client.post(
            f"/api/v1/matches/{bout['id']}/lot",
            json={"side": side, "method": "ONLINE_DICE"},
            headers=headers,
        )
        assert drawn.status_code == 201, drawn.text

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["detail"]["code"] == "BOUT_IN_FLIGHT"


def test_someone_already_in_this_draw_cannot_replace():
    """A fighter in two seats of one bracket could be made to meet themselves."""
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Сергей"]},
        headers=headers,
    )
    assert refused.status_code == 400, refused.text
    assert refused.json()["detail"]["code"] == "ALREADY_IN_COMPETITION"


def test_a_replacement_outside_the_age_bounds_is_refused():
    client = setup_app_for_tests()
    tournament_id, headers = make_tournament(client)
    children = make_competition(client, tournament_id, "Абсолютная детская", max_age=14)
    adults = make_competition(client, tournament_id, "Абсолютная мужская")

    ids = {}
    for index, name in enumerate(["Мал", "Мала", "Мало", "Малы"], start=1):
        ids[name] = entered(client, children, name, birth_year=2014, seed=index)
    grown_up = entered(client, adults, "Взрослый", birth_year=1990)

    generated = client.post(
        f"/api/v1/competitions/{children}/bracket/generate", json={}, headers=headers
    )
    assert generated.status_code == 201, generated.text

    refused = client.post(
        f"/api/v1/participants/{ids['Мал']}/withdraw",
        json={"reason": "Заболел", "replacement_participant_id": grown_up},
        headers=headers,
    )
    assert refused.status_code == 400, refused.text
    assert refused.json()["detail"]["code"] == "AGE_OUT_OF_BOUNDS"


def test_replacing_requires_an_authorized_manager():
    client = setup_app_for_tests()
    competition_id, ids, _, _ = four_with_reserve(client)

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
    )
    assert refused.status_code in (401, 403), refused.text


# ------------------------------------------------------------ the suggestion


def test_the_suggestion_puts_a_clubmate_reserve_first():
    client = setup_app_for_tests()
    tournament_id, headers = make_tournament(client)
    competition_id = make_competition(client, tournament_id, "Абсолютная мужская")

    ids = {}
    for index, (name, club) in enumerate(
        [("Иван", "Мста"), ("Пётр", "Волхов"), ("Сергей", "Ильмень"), ("Фёдор", "Волхов")],
        start=1,
    ):
        ids[name] = entered(client, competition_id, name, club_name=club, seed=index)
    other_reserve = entered(client, competition_id, "Чужой запас", club_name="Волхов", status="RESERVE")
    clubmate = entered(client, competition_id, "Свой запас", club_name="Мста", status="RESERVE")

    generated = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json={}, headers=headers
    )
    assert generated.status_code == 201, generated.text

    suggested = client.get(f"/api/v1/participants/{ids['Иван']}/replacement-candidates")
    assert suggested.status_code == 200, suggested.text
    candidates = suggested.json()["candidates"]
    order = [c["participant_id"] for c in candidates]

    assert order[0] == clubmate, "the departing fighter's own club comes first"
    assert other_reserve in order
    assert candidates[0]["reason"] == "SAME_CLUB_RESERVE"
    # Nobody already in this bracket may be offered.
    assert ids["Пётр"] not in order


def test_the_suggestion_writes_nothing():
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)

    before = status_of(client, competition_id, ids["Запас"])
    client.get(f"/api/v1/participants/{ids['Иван']}/replacement-candidates")
    after = status_of(client, competition_id, ids["Запас"])

    assert before == after == "RESERVE"
    assert [e for e in events(client, competition_id) if e["event_type"] == "PARTICIPANT_REPLACED"] == []


# ------------------------------------ replacing someone already withdrawn


def withdrawn_first(client):
    """Иван is out; Фёдор has the walkover and already sits in the final."""
    competition_id, ids, headers, _ = four_with_reserve(client)
    gone = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма"},
        headers=headers,
    )
    assert gone.status_code == 200, gone.text
    assert len(gone.json()["walkovers"]) == 1
    return competition_id, ids, headers


def test_a_late_replacement_reopens_the_bout_that_was_given_away():
    """The substitute was found an hour after the withdrawal, as happens."""
    client = setup_app_for_tests()
    competition_id, ids, headers = withdrawn_first(client)
    # Фёдор now sits in two bouts — the one he was given and the final it sent
    # him to — so the semifinal has to be named by its stage.
    semifinal = [
        m
        for m in matches(client, competition_id)
        if m["stage"] == "SEMIFINAL"
        and ids["Фёдор"] in {s["id"] for s in (m["participant_a"], m["participant_b"]) if s}
    ][0]

    late = client.post(
        f"/api/v1/participants/{ids['Иван']}/replace",
        json={"reason": "Клуб выставил замену", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert late.status_code == 200, late.text
    assert late.json()["replacement"]["participant_id"] == ids["Запас"]
    assert [s["match_id"] for s in late.json()["reopened"]] == [semifinal["id"]]

    reopened = match_of(matches(client, competition_id), ids["Запас"], ids["Фёдор"])
    assert reopened["id"] == semifinal["id"]
    assert reopened["status"] != "FINISHED"
    assert reopened["winner_id"] is None
    assert reopened["result"] is None


def test_the_opponent_is_taken_back_out_of_the_next_round():
    """A walkover that is undone must undo the advancement it caused."""
    client = setup_app_for_tests()
    competition_id, ids, headers = withdrawn_first(client)
    final_before = [m for m in matches(client, competition_id) if m["stage"] == "FINAL"][0]
    seated = {
        side["id"] for side in (final_before["participant_a"], final_before["participant_b"]) if side
    }
    assert ids["Фёдор"] in seated, "the walkover put Фёдор in the final"

    client.post(
        f"/api/v1/participants/{ids['Иван']}/replace",
        json={"reason": "Клуб выставил замену", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )

    final_after = [m for m in matches(client, competition_id) if m["stage"] == "FINAL"][0]
    still = {
        side["id"] for side in (final_after["participant_a"], final_after["participant_b"]) if side
    }
    assert ids["Фёдор"] not in still


def test_a_late_replacement_is_refused_once_the_opponent_has_fought_on():
    """Undoing the walkover would invalidate a bout that really happened."""
    client = setup_app_for_tests()
    competition_id, ids, headers = withdrawn_first(client)

    other = match_of(matches(client, competition_id), ids["Пётр"], ids["Сергей"])
    played = client.post(
        f"/api/v1/matches/{other['id']}/result",
        json={"match_id": other["id"], "winner_id": ids["Пётр"], "method": "JUDGE_DECISION"},
    )
    assert played.status_code == 201, played.text

    final = match_of(matches(client, competition_id), ids["Фёдор"], ids["Пётр"])
    decided = client.post(
        f"/api/v1/matches/{final['id']}/result",
        json={"match_id": final["id"], "winner_id": ids["Фёдор"], "method": "JUDGE_DECISION"},
    )
    assert decided.status_code == 201, decided.text

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/replace",
        json={"reason": "Поздно", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["detail"]["code"] == "OPPONENT_ALREADY_FOUGHT"


def test_a_fighter_still_in_the_draw_is_not_replaced_this_way():
    """While they are still in, the substitution belongs to the withdrawal."""
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/replace",
        json={"reason": "Рано", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["detail"]["code"] == "STILL_IN_THE_DRAW"


def test_the_journal_records_the_reversal():
    client = setup_app_for_tests()
    competition_id, ids, headers = withdrawn_first(client)

    client.post(
        f"/api/v1/participants/{ids['Иван']}/replace",
        json={"reason": "Клуб выставил замену", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )

    journal = events(client, competition_id)
    replaced = [e for e in journal if e["event_type"] == "PARTICIPANT_REPLACED"]
    assert len(replaced) == 1, replaced
    assert replaced[0]["payload"]["replacement_participant_id"] == ids["Запас"]
    # The walkover that was taken back is its own entry: the journal is read as
    # a list of what happened, and this happened.
    assert [e for e in journal if e["event_type"] == "WALKOVER_REVERSED"]


def test_a_late_replacement_requires_an_authorized_manager():
    client = setup_app_for_tests()
    _, ids, _ = withdrawn_first(client)

    refused = client.post(
        f"/api/v1/participants/{ids['Иван']}/replace",
        json={"reason": "Клуб выставил замену", "replacement_participant_id": ids["Запас"]},
    )
    assert refused.status_code in (401, 403), refused.text


# ------------------------------------------------------------- end to end


def test_a_reserve_steps_in_and_goes_on_to_win():
    client = setup_app_for_tests()
    competition_id, ids, headers, _ = four_with_reserve(client)

    swapped = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма", "replacement_participant_id": ids["Запас"]},
        headers=headers,
    )
    assert swapped.status_code == 200, swapped.text

    semifinal = match_of(matches(client, competition_id), ids["Запас"], ids["Фёдор"])
    other = match_of(matches(client, competition_id), ids["Пётр"], ids["Сергей"])
    for bout, winner in ((semifinal, ids["Запас"]), (other, ids["Пётр"])):
        recorded = client.post(
            f"/api/v1/matches/{bout['id']}/result",
            json={"match_id": bout["id"], "winner_id": winner, "method": "JUDGE_DECISION"},
        )
        assert recorded.status_code == 201, recorded.text

    final = match_of(matches(client, competition_id), ids["Запас"], ids["Пётр"])
    recorded = client.post(
        f"/api/v1/matches/{final['id']}/result",
        json={"match_id": final["id"], "winner_id": ids["Запас"], "method": "JUDGE_DECISION"},
    )
    assert recorded.status_code == 201, recorded.text

    decided = match_of(matches(client, competition_id), ids["Запас"], ids["Пётр"])
    assert decided["status"] == "FINISHED"
    assert decided["winner_id"] == ids["Запас"]
