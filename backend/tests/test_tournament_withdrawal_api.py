"""Withdrawing a fighter from a competition that is already under way.

The rule being pinned down here is that a withdrawal is *not* a rebuild. The
bracket keeps its shape, its match ids and its numbering; what changes is that
every bout the fighter has not fought is settled as a walkover for whoever was
supposed to meet them. Bouts they already fought are left exactly as they were
fought — `docs/architecture.md` requires history to be preserved, and a
rebuild would quietly invalidate real results.

Setup follows the convention of the other API tests: an in-memory
``sqlite+aiosqlite`` engine swapped into ``app.core.database`` and driven
through ``TestClient``.
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
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Судья"},
    )
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"], headers


def bootstrap(client, entrants: list[tuple[str, str]]):
    organizer_id, headers = register_user(client, "organizer@example.com")

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
            "name": "Абсолютная взрослая",
            "type": "INDIVIDUAL",
            "format": "SINGLE_ELIMINATION",
            "status": "REGISTRATION",
        },
    )
    assert competition.status_code == 201, competition.text
    competition_id = competition.json()["id"]

    ids = {}
    for index, (name, city) in enumerate(entrants, start=1):
        response = client.post(
            f"/api/v1/competitions/{competition_id}/participants",
            # Seeded so the bracket is deterministic: rank order is exactly the
            # order given, and `standard_seed_order` then fixes every pairing.
            json={
                "competition_id": competition_id,
                "display_name": name,
                "city": city,
                "seed": index,
            },
        )
        assert response.status_code == 201, response.text
        ids[name] = response.json()["id"]
    return tournament_id, competition_id, ids, headers


def matches(client, competition_id: str) -> list[dict]:
    response = client.get(f"/api/v1/competitions/{competition_id}/matches")
    assert response.status_code == 200, response.text
    return response.json()


def match_of(rows: list[dict], *participant_ids: str) -> dict:
    """The one match seating exactly this set of fighters."""
    wanted = set(participant_ids)
    found = [
        row
        for row in rows
        if wanted <= {side["id"] for side in (row["participant_a"], row["participant_b"]) if side}
    ]
    assert len(found) == 1, f"expected one match for {wanted}, got {len(found)}"
    return found[0]


def events(client, competition_id: str) -> list[dict]:
    response = client.get(f"/api/v1/competitions/{competition_id}/events")
    assert response.status_code == 200, response.text
    return response.json()


def four_fighter_bracket(client):
    """A clean 4-slot bracket: two semifinals into a final, no byes."""
    _, competition_id, ids, headers = bootstrap(
        client,
        [("Иван", "Новгород"), ("Пётр", "Псков"), ("Сергей", "Тверь"), ("Фёдор", "Москва")],
    )
    generated = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json={}, headers=headers
    )
    assert generated.status_code == 201, generated.text
    assert generated.json()["bye_count"] == 0
    return competition_id, ids, headers


# ------------------------------------------------------- the ordinary case


def test_withdrawing_hands_the_bout_to_the_opponent_and_advances_them():
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

    before = matches(client, competition_id)
    bout = match_of(before, ids["Иван"], ids["Фёдор"])  # seeds 1 and 4 meet
    opponent_id = ids["Фёдор"]

    response = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма плеча"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["to_status"] == "WITHDRAWN"
    assert [w["match_id"] for w in body["walkovers"]] == [bout["id"]]
    assert body["walkovers"][0]["opponent_id"] == opponent_id

    after = matches(client, competition_id)
    settled = next(row for row in after if row["id"] == bout["id"])
    assert settled["status"] == "FINISHED"
    assert settled["winner_id"] == opponent_id

    # The result is a real recorded decision, readable like any other.
    result = client.get(f"/api/v1/matches/{bout['id']}/result")
    assert result.status_code == 200, result.text
    assert result.json()["method"] == "WITHDRAWAL"
    assert result.json()["comment"] == "Травма плеча"

    # And the opponent is seated in the next round through the normal wiring.
    final = next(row for row in after if row["stage"] == "FINAL")
    assert opponent_id in {side["id"] for side in (final["participant_a"], final["participant_b"]) if side}


def test_the_bracket_is_not_rebuilt():
    """Match ids and pairings survive a withdrawal untouched."""
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

    before = {row["id"]: row for row in matches(client, competition_id)}
    other_semi = match_of(list(before.values()), ids["Пётр"], ids["Сергей"])

    response = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Снялся сам"},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    after = {row["id"]: row for row in matches(client, competition_id)}
    assert set(after) == set(before), "a withdrawal must not add or remove matches"

    untouched = after[other_semi["id"]]
    assert untouched["participant_a"] == other_semi["participant_a"]
    assert untouched["participant_b"] == other_semi["participant_b"]
    assert untouched["status"] == other_semi["status"]


def test_a_bout_that_was_already_fought_is_left_alone():
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

    rows = matches(client, competition_id)
    fought = match_of(rows, ids["Пётр"], ids["Сергей"])
    recorded = client.post(
        f"/api/v1/matches/{fought['id']}/result",
        json={"match_id": fought["id"], "winner_id": ids["Пётр"], "method": "JUDGE_DECISION"},
    )
    assert recorded.status_code == 201, recorded.text

    # Сергей lost that bout and now withdraws; the loss must stand as fought.
    response = client.post(
        f"/api/v1/participants/{ids['Сергей']}/withdraw",
        json={"reason": "Уехал"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["walkovers"] == []

    result = client.get(f"/api/v1/matches/{fought['id']}/result")
    assert result.status_code == 200, result.text
    assert result.json()["method"] == "JUDGE_DECISION"
    assert result.json()["winner_id"] == ids["Пётр"]


def test_the_reason_reaches_the_journal():
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

    client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Дисквалификация за опасный приём", "status": "DISQUALIFIED"},
        headers=headers,
    ).raise_for_status()

    journal = events(client, competition_id)
    disqualified = [e for e in journal if e["event_type"] == "PARTICIPANT_DISQUALIFIED"]
    assert len(disqualified) == 1
    assert disqualified[0]["payload"]["reason"] == "Дисквалификация за опасный приём"
    assert disqualified[0]["payload"]["to_status"] == "DISQUALIFIED"

    walkover = [e for e in journal if e["event_type"] == "WALKOVER_GRANTED"]
    assert len(walkover) == 1
    assert walkover[0]["payload"]["result_type"] == "DISQUALIFICATION"

    # The status change is on the participant's own record too.
    history = client.get(f"/api/v1/participants/{ids['Иван']}/status-history")
    assert history.status_code == 200, history.text
    assert history.json()[-1]["new_status"] == "DISQUALIFIED"


def test_withdrawing_twice_is_refused():
    client = setup_app_for_tests()
    _, ids, headers = four_fighter_bracket(client)

    first = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw", json={"reason": "Травма"}, headers=headers
    )
    assert first.status_code == 200, first.text
    second = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw", json={"reason": "Ещё раз"}, headers=headers
    )
    assert second.status_code == 409, second.text


def test_a_started_bout_blocks_the_withdrawal():
    """The judge finishes or cancels it; we do not overwrite a thrown lot."""
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

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
        json={"reason": "Передумал"},
        headers=headers,
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["detail"]["code"] == "BOUT_IN_FLIGHT"
    assert refused.json()["detail"]["match_ids"] == [bout["id"]]


# --------------------------------------------- the deferred walkover case


def test_withdrawing_before_the_next_opponent_is_known_settles_later():
    """The hole a naive implementation leaves.

    A fighter seated in a match whose other slot is still empty cannot have
    that bout awarded to anyone — there is nobody to award it to. Withdrawing
    them must therefore leave the bout open and settle it later, the moment the
    other half of the draw produces an opponent. Without that second check the
    final would hang forever with a fighter in it who is not coming.

    Driven entirely through walkovers, because those advance the winner through
    the bracket wiring; recording a result on its own does not (that path
    belongs to the bout flow and is out of scope here).
    """
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

    # Фёдор pulls out, so Иван walks into the final and sits there alone.
    client.post(
        f"/api/v1/participants/{ids['Фёдор']}/withdraw",
        json={"reason": "Не приехал"},
        headers=headers,
    ).raise_for_status()

    final = next(row for row in matches(client, competition_id) if row["stage"] == "FINAL")
    seated = {side["id"] for side in (final["participant_a"], final["participant_b"]) if side}
    assert seated == {ids["Иван"]}, "only one finalist should be known at this point"

    # Now Иван withdraws too. Nothing can be awarded yet, and the response says
    # so rather than pretending the final is settled.
    withdrawal = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Не вышел на финал"},
        headers=headers,
    )
    assert withdrawal.status_code == 200, withdrawal.text
    body = withdrawal.json()
    assert body["walkovers"] == []
    assert [w["stage"] for w in body["pending_walkovers"]] == ["FINAL"]

    still_open = next(row for row in matches(client, competition_id) if row["id"] == final["id"])
    assert still_open["status"] != "FINISHED"

    # The other semifinal resolves, Пётр is seated opposite a fighter who is
    # already out, and the final settles itself.
    client.post(
        f"/api/v1/participants/{ids['Сергей']}/withdraw",
        json={"reason": "Травма"},
        headers=headers,
    ).raise_for_status()

    settled = next(row for row in matches(client, competition_id) if row["id"] == final["id"])
    assert settled["status"] == "FINISHED"
    assert settled["winner_id"] == ids["Пётр"]

    champion = client.get(f"/api/v1/competitions/{competition_id}/champion")
    assert champion.status_code == 200, champion.text
    assert champion.json()["complete"] is True
    assert champion.json()["champion"]["id"] == ids["Пётр"]


def test_a_match_between_two_withdrawn_fighters_is_not_awarded():
    """No winner exists, so none is invented."""
    client = setup_app_for_tests()
    competition_id, ids, headers = four_fighter_bracket(client)

    bout = match_of(matches(client, competition_id), ids["Иван"], ids["Фёдор"])
    client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw", json={"reason": "Травма"}, headers=headers
    ).raise_for_status()
    # The first withdrawal already awarded the bout to Фёдор; his own later
    # withdrawal must not disturb that finished result.
    settled = next(row for row in matches(client, competition_id) if row["id"] == bout["id"])
    assert settled["winner_id"] == ids["Фёдор"]

    client.post(
        f"/api/v1/participants/{ids['Фёдор']}/withdraw", json={"reason": "Тоже снялся"}, headers=headers
    ).raise_for_status()
    unchanged = next(row for row in matches(client, competition_id) if row["id"] == bout["id"])
    assert unchanged["winner_id"] == ids["Фёдор"]
    assert unchanged["status"] == "FINISHED"


# ----------------------------------------------------------------- guards


def test_withdrawal_requires_an_authorized_manager():
    client = setup_app_for_tests()
    _, ids, _ = four_fighter_bracket(client)

    anonymous = client.post(f"/api/v1/participants/{ids['Иван']}/withdraw", json={"reason": "Травма"})
    assert anonymous.status_code == 401, anonymous.text

    _, stranger_headers = register_user(client, "stranger@example.com")
    forbidden = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw",
        json={"reason": "Травма"},
        headers=stranger_headers,
    )
    assert forbidden.status_code == 403, forbidden.text


def test_a_withdrawal_must_carry_a_reason():
    client = setup_app_for_tests()
    _, ids, headers = four_fighter_bracket(client)

    blank = client.post(
        f"/api/v1/participants/{ids['Иван']}/withdraw", json={"reason": ""}, headers=headers
    )
    assert blank.status_code == 422, blank.text
