"""The поединок: жребий, соступ, win conditions, advancement and the 3x3 phase.

Weapons are pinned with PHYSICAL_DICE face values so the rules are exercised
deterministically: face 1 = тростка, 2 = нож, 3 = безоружный, 4 = кистень.
"""

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base

PALKA, NOZH, HANDS, KISTEN = 1, 2, 3, 4


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
        json={"email": email, "password": "StrongPassword123!", "first_name": "Ivan", "last_name": "Judge"},
    )
    assert response.status_code == 201, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    return me.json()["id"], headers


def bootstrap_bracket(client, entrants=None, *, competition_type="INDIVIDUAL", final_weapon=None):
    entrants = entrants or [
        ("Иванов", "Новгород"),
        ("Петров", "Псков"),
        ("Сидоров", "Тверь"),
        ("Кузнецов", "Москва"),
    ]
    organizer_id, headers = register(client, "organizer@example.com")

    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Турнир",
            "status": "REGISTRATION",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    tournament_id = tournament.json()["id"]
    competition = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={
            "tournament_id": tournament_id,
            "name": "Мужчины",
            "type": competition_type,
            "format": "SINGLE_ELIMINATION",
        },
    )
    competition_id = competition.json()["id"]

    for name, city in entrants:
        response = client.post(
            f"/api/v1/competitions/{competition_id}/participants",
            json={"competition_id": competition_id, "display_name": name, "city": city},
        )
        assert response.status_code == 201, response.text

    body = {"final_weapon": final_weapon} if final_weapon else {}
    generated = client.post(
        f"/api/v1/competitions/{competition_id}/bracket/generate", json=body, headers=headers
    )
    assert generated.status_code == 201, generated.text
    return tournament_id, competition_id, headers


def rounds_of(client, competition_id: str) -> list[dict]:
    bracket = client.get(f"/api/v1/competitions/{competition_id}/bracket").json()
    return sorted(bracket["rounds"], key=lambda r: r["order"])


def semis(client, competition_id: str) -> list[dict]:
    return sorted(rounds_of(client, competition_id)[0]["matches"], key=lambda m: m["position"])


def final_of(client, competition_id: str) -> dict:
    return rounds_of(client, competition_id)[-1]["matches"][0]


def draw(client, match_id, headers, side, face):
    return client.post(
        f"/api/v1/matches/{match_id}/lot",
        json={"side": side, "method": "PHYSICAL_DICE", "die_value": face},
        headers=headers,
    )


def run_bout(client, match_id, headers, *, red_face, blue_face):
    """Draw both lots and start the bout."""
    assert draw(client, match_id, headers, "RED", red_face).status_code == 201
    assert draw(client, match_id, headers, "BLUE", blue_face).status_code == 201
    started = client.post(f"/api/v1/matches/{match_id}/start", headers=headers)
    assert started.status_code == 200, started.text
    return started.json()


def score(client, match_id, headers, round_number, participant_id, action_code):
    return client.post(
        f"/api/v1/matches/{match_id}/rounds/{round_number}/score",
        json={"participant_id": participant_id, "action_code": action_code},
        headers=headers,
    )


def open_round(client, match_id, headers):
    response = client.post(f"/api/v1/matches/{match_id}/rounds", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["round_number"]


# ----------------------------------------------------------------- the lot


def test_a_second_lot_on_the_same_side_is_rejected():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]

    first = draw(client, match["id"], headers, "RED", NOZH)
    assert first.status_code == 201, first.text
    assert first.json()["weapon"] == "NOZH"
    assert first.json()["die_value"] == NOZH

    again = draw(client, match["id"], headers, "RED", PALKA)
    assert again.status_code == 409, again.text
    assert "already drawn" in again.json()["detail"]

    # The original draw is untouched.
    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert bout["weapon_red"] == "NOZH"
    assert len([lot for lot in bout["lots"] if lot["side"] == "RED"]) == 1


def test_no_lot_may_be_drawn_for_a_final():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    final = final_of(client, competition_id)

    refused = draw(client, final["id"], headers, "RED", NOZH)
    assert refused.status_code == 400, refused.text
    assert "final" in refused.json()["detail"].lower()

    # And the bout view says so, so the UI has no reason to offer the control.
    bout = client.get(f"/api/v1/matches/{final['id']}/bout").json()
    assert bout["is_final"] is True
    assert bout["lot_required"] is False


def test_online_lot_is_generated_and_persisted_by_the_server():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]

    response = client.post(
        f"/api/v1/matches/{match['id']}/lot",
        json={"side": "RED", "method": "ONLINE_DICE"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["method"] == "ONLINE_DICE"
    assert 1 <= body["die_value"] <= 4
    assert body["weapon"] in {"PALKA", "NOZH", "HANDS", "KISTEN"}

    # Already fixed and readable back — the client cannot influence it.
    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert bout["weapon_red"] == body["weapon"]


def test_lot_override_supersedes_and_is_audited():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    assert draw(client, match["id"], headers, "RED", NOZH).status_code == 201

    override = client.post(
        f"/api/v1/matches/{match['id']}/lot/override",
        json={
            "side": "RED",
            "method": "PHYSICAL_DICE",
            "die_value": PALKA,
            "reason": "Кубик упал со стола, перебросили",
        },
        headers=headers,
    )
    assert override.status_code == 201, override.text
    assert override.json()["weapon"] == "PALKA"
    assert override.json()["sequence"] == 2

    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert bout["weapon_red"] == "PALKA"

    events = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    overrides = [e for e in events if e["event_type"] == "LOT_OVERRIDDEN"]
    assert len(overrides) == 1
    assert overrides[0]["payload"]["previous"]["weapon"] == "NOZH"
    assert overrides[0]["payload"]["new"]["weapon"] == "PALKA"
    assert overrides[0]["payload"]["reason"]


def test_a_bout_cannot_start_before_both_sides_have_drawn():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]

    premature = client.post(f"/api/v1/matches/{match['id']}/start", headers=headers)
    assert premature.status_code == 409, premature.text

    assert draw(client, match["id"], headers, "RED", NOZH).status_code == 201
    still = client.post(f"/api/v1/matches/{match['id']}/start", headers=headers)
    assert still.status_code == 409, still.text

    assert draw(client, match["id"], headers, "BLUE", PALKA).status_code == 201
    started = client.post(f"/api/v1/matches/{match['id']}/start", headers=headers)
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "IN_PROGRESS"


# ------------------------------------------------------- win-condition engine


def test_unarmed_wins_the_whole_bout_with_a_single_disarm():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=HANDS, blue_face=NOZH)

    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert bout["weapon_red"] == "HANDS"
    assert bout["required_rounds_red"] == 1
    assert bout["required_rounds_blue"] == 3

    number = open_round(client, match["id"], headers)
    result = score(client, match["id"], headers, number, match["participant_a"]["id"], "DISARM")
    assert result.status_code == 200, result.text
    body = result.json()

    assert body["match"]["status"] == "FINISHED"
    assert body["match"]["winner_id"] == match["participant_a"]["id"]
    assert body["match"]["result"]["method"] == "DISARM"
    assert body["rounds"][0]["end_reason"] == "DISARM"
    assert body["rounds_won_red"] == 1


def test_armed_fighter_must_win_all_three_rounds_against_unarmed():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=NOZH, blue_face=HANDS)

    red = match["participant_a"]["id"]
    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert bout["required_rounds_red"] == 3
    assert bout["required_rounds_blue"] == 1

    for expected_wins in (1, 2):
        number = open_round(client, match["id"], headers)
        body = score(client, match["id"], headers, number, red, "NOZH_ACCENTED").json()
        assert body["rounds_won_red"] == expected_wins
        # Two соступ are not enough — the поединок is still running.
        assert body["match"]["status"] == "IN_PROGRESS"

    number = open_round(client, match["id"], headers)
    body = score(client, match["id"], headers, number, red, "NOZH_NECK").json()
    assert body["rounds_won_red"] == 3
    assert body["match"]["status"] == "FINISHED"
    assert body["match"]["winner_id"] == red
    assert body["match"]["result"]["method"] == "ROUND_WINS"


def test_weapon_versus_weapon_is_first_to_two_rounds():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=PALKA, blue_face=NOZH)

    red, blue = match["participant_a"]["id"], match["participant_b"]["id"]
    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert (bout["required_rounds_red"], bout["required_rounds_blue"]) == (2, 2)
    # нож vs тростка carries the judge-facing staging note.
    assert bout["staging_note"] and "трость" in bout["staging_note"]

    number = open_round(client, match["id"], headers)
    score(client, match["id"], headers, number, red, "PALKA_HEAD")

    number = open_round(client, match["id"], headers)
    score(client, match["id"], headers, number, blue, "NOZH_NECK")

    number = open_round(client, match["id"], headers)
    body = score(client, match["id"], headers, number, red, "PALKA_HEAD").json()

    assert body["rounds_won_red"] == 2
    assert body["rounds_won_blue"] == 1
    assert body["match"]["status"] == "FINISHED"
    assert body["match"]["winner_id"] == red


def test_points_accumulate_to_three_within_a_sostup():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=PALKA, blue_face=PALKA)
    red = match["participant_a"]["id"]

    number = open_round(client, match["id"], headers)
    body = score(client, match["id"], headers, number, red, "PALKA_BODY").json()
    assert body["rounds"][0]["points_red"] == 2
    assert body["rounds"][0]["status"] == "IN_PROGRESS"

    body = score(client, match["id"], headers, number, red, "PALKA_LIMB").json()
    assert body["rounds"][0]["points_red"] == 3
    assert body["rounds"][0]["status"] == "COMPLETED"
    assert body["rounds"][0]["end_reason"] == "POINTS"
    assert body["rounds_won_red"] == 1
    # One соступ of a best-of-three is not the поединок.
    assert body["match"]["status"] == "IN_PROGRESS"


def test_an_action_from_another_weapon_is_refused():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=PALKA, blue_face=NOZH)

    number = open_round(client, match["id"], headers)
    wrong = score(client, match["id"], headers, number, match["participant_a"]["id"], "NOZH_NECK")
    assert wrong.status_code == 400, wrong.text
    assert "PALKA" in wrong.json()["detail"]


def test_kisten_rounds_carry_a_binary_winner_and_no_invented_points():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=KISTEN, blue_face=PALKA)
    red = match["participant_a"]["id"]

    number = open_round(client, match["id"], headers)
    body = score(client, match["id"], headers, number, red, "KISTEN_CLEAN").json()

    assert body["rounds"][0]["status"] == "COMPLETED"
    assert body["rounds"][0]["end_reason"] == "KISTEN_CLEAN"
    # No point value is invented for kistenʹ, so the tally stays at zero.
    assert body["rounds"][0]["points_red"] == 0
    assert body["rounds"][0]["scores"][0]["points"] is None
    assert body["rounds_won_red"] == 1


def test_a_fourth_sostup_cannot_be_opened():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=NOZH, blue_face=HANDS)
    red = match["participant_a"]["id"]

    for _ in range(3):
        number = open_round(client, match["id"], headers)
        score(client, match["id"], headers, number, red, "NOZH_ACCENTED")

    # The bout ended on the third соступ, so a fourth is refused twice over.
    fourth = client.post(f"/api/v1/matches/{match['id']}/rounds", headers=headers)
    assert fourth.status_code == 409, fourth.text


def test_a_clinched_weapon_v_weapon_bout_still_plays_its_third_sostup():
    """CLIENT CORRECTION: a race-to-2 поединок does not stop the moment one
    side reaches 2 — all three соступ are always played, and only the third
    one's completion finishes the поединок."""
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]
    run_bout(client, match["id"], headers, red_face=PALKA, blue_face=PALKA)
    red = match["participant_a"]["id"]
    blue = match["participant_b"]["id"]

    # Red clinches the win-condition threshold (2 of 3) after just two соступ...
    for _ in range(2):
        number = open_round(client, match["id"], headers)
        body = score(client, match["id"], headers, number, red, "PALKA_HEAD").json()
    assert body["rounds_won_red"] == 2
    # ...but the поединок must not be over yet.
    assert body["match"]["status"] == "IN_PROGRESS"

    # A third соступ can still be opened and fought (won by the other side —
    # it changes nothing about who takes the поединок, only that it happened).
    number = open_round(client, match["id"], headers)
    body = score(client, match["id"], headers, number, blue, "PALKA_HEAD").json()
    assert body["rounds_won_red"] == 2
    assert body["rounds_won_blue"] == 1
    assert body["match"]["status"] == "FINISHED"
    assert body["match"]["winner_id"] == red

    bout = client.get(f"/api/v1/matches/{match['id']}/bout").json()
    assert len(bout["rounds"]) == 3


# ------------------------------------------------------------- advancement


def _finish_bout(client, match, headers, *, winner_slot="participant_a"):
    """Run a бой to a decision, unarmed-disarm style, and return the winner id."""
    run_bout(client, match["id"], headers, red_face=HANDS, blue_face=NOZH)
    winner = match[winner_slot]["id"]
    number = open_round(client, match["id"], headers)
    if winner_slot == "participant_a":
        response = score(client, match["id"], headers, number, winner, "DISARM")
    else:
        # The armed side must take all three соступ.
        response = score(client, match["id"], headers, number, winner, "NOZH_ACCENTED")
        for _ in range(2):
            number = open_round(client, match["id"], headers)
            response = score(client, match["id"], headers, number, winner, "NOZH_ACCENTED")
    assert response.status_code == 200, response.text
    return winner


def test_completing_a_bout_seats_the_winner_in_the_next_round():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    semi_a, semi_b = semis(client, competition_id)

    winner_a = _finish_bout(client, semi_a, headers)

    final = final_of(client, competition_id)
    assert final["participant_a"] is not None
    assert final["participant_a"]["id"] == winner_a
    assert final["participant_b"] is None
    # Half-filled, so it is still waiting rather than ready.
    assert final["status"] == "SCHEDULED"

    winner_b = _finish_bout(client, semi_b, headers, winner_slot="participant_b")

    final = final_of(client, competition_id)
    assert {final["participant_a"]["id"], final["participant_b"]["id"]} == {winner_a, winner_b}
    assert final["status"] == "READY"

    events = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    advanced = [e for e in events if e["event_type"] == "PARTICIPANT_ADVANCED"]
    assert len(advanced) == 2
    assert {e["payload"]["participant_id"] for e in advanced} == {winner_a, winner_b}


def test_state_survives_a_reload_and_a_champion_is_summarised():
    """Everything is reconstructed from the backend, nothing held client-side."""
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client, final_weapon="PALKA")
    semi_a, semi_b = semis(client, competition_id)

    winner_a = _finish_bout(client, semi_a, headers)
    _finish_bout(client, semi_b, headers, winner_slot="participant_b")

    # No champion is claimed while the final is still open.
    assert client.get(f"/api/v1/competitions/{competition_id}/champion").json()["complete"] is False

    final = final_of(client, competition_id)
    # A final's weapons are fixed rather than drawn, so it starts straight away.
    started = client.post(f"/api/v1/matches/{final['id']}/start", headers=headers)
    assert started.status_code == 200, started.text

    champion_id = final["participant_a"]["id"]
    # CLIENT CORRECTION: every соступ is played, even once the win-condition
    # threshold (2 of 3, here) is already mathematically clinched — so all
    # three are recorded, not just the two that decide it.
    for _ in range(3):
        number = open_round(client, final["id"], headers)
        score(client, final["id"], headers, number, champion_id, "PALKA_HEAD")

    # --- the "reload": every read below is a fresh request over the wire. ---
    bracket_rounds = rounds_of(client, competition_id)
    assert [len(r["matches"]) for r in bracket_rounds] == [2, 1]
    assert all(m["status"] == "FINISHED" for r in bracket_rounds for m in r["matches"])

    refetched_final = final_of(client, competition_id)
    assert refetched_final["winner_id"] == champion_id
    assert refetched_final["weapon_red"] == "PALKA"
    assert refetched_final["rounds_won_red"] == 3

    bout = client.get(f"/api/v1/matches/{final['id']}/bout").json()
    assert len(bout["rounds"]) == 3
    assert all(r["status"] == "COMPLETED" for r in bout["rounds"])

    summary = client.get(f"/api/v1/competitions/{competition_id}/champion").json()
    assert summary["complete"] is True
    assert summary["champion"]["id"] == champion_id
    # The city is the one actually on that entry — the draw is random, so the
    # summary is checked against the registration record, not a fixed name.
    entered = {p["id"]: p for p in client.get(f"/api/v1/competitions/{competition_id}/participants").json()}
    assert summary["champion"]["city"] == entered[champion_id]["city"]
    assert summary["champion"]["city"] in {"Новгород", "Псков", "Тверь", "Москва"}
    # The path is the real recorded run: semifinal then final, both won.
    assert [entry["stage"] for entry in summary["path"]] == ["SEMIFINAL", "FINAL"]
    assert all(entry["won"] for entry in summary["path"])
    assert summary["path"][-1]["weapon"] == "PALKA"

    tournament = client.get(f"/api/v1/tournaments/{_tournament_id(client)}").json()
    assert tournament["status"] == "FINISHED"


def _tournament_id(client) -> str:
    return client.get("/api/v1/tournaments").json()[0]["id"]


# -------------------------------------------------------------- 3x3 teams


def test_team_bouts_aggregate_three_pairings():
    client = setup_app_for_tests()
    organizer_id, headers = register(client, "organizer@example.com")

    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Командный турнир",
            "status": "REGISTRATION",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    tournament_id = tournament.json()["id"]
    competition = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={"tournament_id": tournament_id, "name": "Трое на трое", "type": "TEAM", "format": "ROUND_ROBIN"},
    )
    competition_id = competition.json()["id"]

    def make_team(name: str, member_prefix: str) -> str:
        team = client.post(
            f"/api/v1/competitions/{competition_id}/teams",
            json={"competition_id": competition_id, "name": name},
        )
        assert team.status_code == 201, team.text
        team_id = team.json()["id"]
        for index in range(3):
            user_id, _ = register(client, f"{member_prefix}{index}@example.com")
            athlete = client.post(
                "/api/v1/athletes", json={"user_id": user_id, "nickname": f"{member_prefix}{index}"}
            )
            assert athlete.status_code == 201, athlete.text
            member = client.post(
                f"/api/v1/teams/{team_id}/members",
                json={"team_id": team_id, "athlete_id": athlete.json()["id"], "role": "FIGHTER"},
            )
            assert member.status_code == 201, member.text
        return team_id

    red_team = make_team("Новгород", "nov")
    make_team("Псков", "psk")

    generated = client.post(
        f"/api/v1/competitions/{competition_id}/team-bouts/generate", headers=headers
    )
    assert generated.status_code == 201, generated.text
    bouts = generated.json()
    assert len(bouts) == 1
    bout = bouts[0]
    assert len(bout["pairings"]) == 3
    assert bout["status"] == "SCHEDULED"

    # A team pairing is decided by a pin and a signalled finishing blow, so it
    # draws no weapon lot — refused by the backend, not merely hidden.
    refused = draw(client, bout["pairings"][0]["id"], headers, "RED", NOZH)
    assert refused.status_code == 400, refused.text

    for index in range(2):
        pairing = bout["pairings"][index]
        recorded = client.post(
            f"/api/v1/matches/{pairing['id']}/team-result",
            json={"winner_participant_id": pairing["participant_a"]["id"]},
            headers=headers,
        )
        assert recorded.status_code == 201, recorded.text

    refreshed = client.get(f"/api/v1/competitions/{competition_id}/team-bouts").json()[0]
    assert refreshed["wins_red"] == 2
    assert refreshed["wins_blue"] == 0
    assert refreshed["status"] == "FINISHED"
    assert refreshed["winner_team_id"] == red_team


# ---------------------------------------------------------------- guardrails


def test_bout_writes_require_an_authorized_manager():
    client = setup_app_for_tests()
    _, competition_id, headers = bootstrap_bracket(client)
    match = semis(client, competition_id)[0]

    anonymous = client.post(
        f"/api/v1/matches/{match['id']}/lot", json={"side": "RED", "method": "ONLINE_DICE"}
    )
    assert anonymous.status_code == 401, anonymous.text

    _, stranger = register(client, "stranger@example.com")
    forbidden = client.post(
        f"/api/v1/matches/{match['id']}/lot",
        json={"side": "RED", "method": "ONLINE_DICE"},
        headers=stranger,
    )
    assert forbidden.status_code == 403, forbidden.text


def test_the_bout_rules_are_served_from_one_place():
    client = setup_app_for_tests()
    rules = client.get("/api/v1/bout-rules")
    assert rules.status_code == 200, rules.text
    body = rules.json()

    assert body["die_sides"] == 4
    assert [w["code"] for w in body["weapons"]] == ["PALKA", "NOZH", "HANDS", "KISTEN"]
    assert body["round_target_points"] == 3
    assert body["max_rounds_per_bout"] == 3

    by_code = {action["code"]: action for action in body["actions"]}
    assert by_code["PALKA_HEAD"]["points"] == 3
    assert by_code["PALKA_BODY"]["points"] == 2
    assert by_code["PALKA_LIMB"]["points"] == 1
    assert by_code["NOZH_LIGHT"]["points"] == 1
    assert by_code["NOZH_NECK"]["points"] == 3
    # No invented point value for kistenʹ, and the disarm ends the whole bout.
    assert by_code["KISTEN_CLEAN"]["points"] is None
    assert by_code["DISARM"]["ends_bout"] is True
