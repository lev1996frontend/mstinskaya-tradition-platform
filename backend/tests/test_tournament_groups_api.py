"""The group stage end to end: deal, play, rank, qualify.

The last test is the scenario the whole feature was asked for — nine entrants,
two subgroups, three out of each, cross-seeded into a bracket, someone withdraws
mid-playoff, and a champion still comes out.
"""

import asyncio
from itertools import combinations

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


def register(client, email: str) -> tuple[str, dict[str, str]]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор"},
    )
    assert response.status_code == 201, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    return me.json()["id"], headers


def bootstrap(client, entrants: list[tuple[str, str]], *, competition_format="GROUP_PLAYOFF"):
    """A discipline with the given ``(name, club)`` entrants, seeded in order."""
    organizer_id, headers = register(client, "organizer@example.com")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Открытый турнир",
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
            "name": "Абсолютная взрослая",
            "type": "INDIVIDUAL",
            "format": competition_format,
            "status": "REGISTRATION",
        },
    )
    assert competition.status_code == 201, competition.text
    competition_id = competition.json()["id"]

    ids: dict[str, str] = {}
    for index, (name, club) in enumerate(entrants, start=1):
        created = client.post(
            f"/api/v1/competitions/{competition_id}/participants",
            json={
                "competition_id": competition_id,
                "display_name": name,
                "club_name": club,
                # Seeded so the deal is deterministic and the tests do not flake.
                "seed": index,
            },
        )
        assert created.status_code == 201, created.text
        ids[name] = created.json()["id"]
    return tournament_id, competition_id, ids, headers


def nine_fighters(client):
    people = [(f"Боец{index}", f"Клуб{index}") for index in range(1, 10)]
    return bootstrap(client, people)


def generate_groups(client, competition_id, headers, *, groups=2, advance=3):
    return client.post(
        f"/api/v1/competitions/{competition_id}/groups/generate",
        json={"group_count": groups, "advance_per_group": advance},
        headers=headers,
    )


def group_stage(client, competition_id) -> dict:
    response = client.get(f"/api/v1/competitions/{competition_id}/groups")
    assert response.status_code == 200, response.text
    return response.json()


def matches(client, competition_id) -> list[dict]:
    return client.get(f"/api/v1/competitions/{competition_id}/matches").json()


def record(client, match_id: str, winner_id: str):
    response = client.post(
        f"/api/v1/matches/{match_id}/result",
        json={"match_id": match_id, "winner_id": winner_id, "method": "JUDGE_DECISION"},
    )
    assert response.status_code == 201, response.text


def play_group_stage(client, competition_id: str, ranking_order: list[str], ids: dict[str, str]):
    """Play every group bout so that ``ranking_order`` decides who beats whom.

    Earlier in the list beats later, which produces a clean table with no ties
    and lets the qualification tests focus on seeding rather than tie-breaks.
    """
    strength = {ids[name]: index for index, name in enumerate(ranking_order)}
    for match in matches(client, competition_id):
        if match["stage"] != "GROUP":
            continue
        a, b = match["participant_a"]["id"], match["participant_b"]["id"]
        record(client, match["id"], a if strength[a] < strength[b] else b)


# ------------------------------------------------------------------ suggestion


def test_the_suggestion_offers_options_and_marks_one():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)

    response = client.post(
        f"/api/v1/competitions/{competition_id}/groups/suggest", headers=headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["participant_count"] == 9
    assert sum(1 for option in body["options"] if option["is_default"]) == 1
    assert any(
        option["group_count"] == 2 and option["advance_per_group"] == 3
        for option in body["options"]
    )
    # Advice, not a decision — and nothing was written.
    assert "организатор" in body["rationale"]
    assert matches(client, competition_id) == []


def test_the_preview_writes_nothing():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)

    response = client.post(
        f"/api/v1/competitions/{competition_id}/groups/preview",
        json={"group_count": 2, "advance_per_group": 3},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["group_count"] == 2
    assert matches(client, competition_id) == []
    assert group_stage(client, competition_id)["groups"] == []


# ------------------------------------------------------------------ generation


def test_nine_fighters_split_into_two_groups_of_five_and_four():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)

    generated = generate_groups(client, competition_id, headers)
    assert generated.status_code == 201, generated.text
    plan = generated.json()
    assert plan["group_count"] == 2
    assert plan["qualifier_count"] == 6
    # 5 fighters → 10 bouts, 4 → 6.
    assert plan["match_count"] == 16
    assert sorted(len(group["members"]) for group in plan["groups"]) == [4, 5]

    stage = group_stage(client, competition_id)
    assert [group["name"] for group in stage["groups"]] == ["Группа А", "Группа Б"]
    assert stage["matches_total"] == 16
    assert stage["matches_finished"] == 0
    assert stage["decided"] is False


def test_group_bouts_are_group_stage_and_lead_nowhere_by_themselves():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()

    rows = matches(client, competition_id)
    assert rows and all(row["stage"] == "GROUP" for row in rows)
    # A group bout advances nobody: there is no next match to be seated in.
    assert all(row["next_match_id"] is None for row in rows)
    # And a sit-out in an odd group is a rest, never a free pass.
    assert all(row["is_bye"] is False for row in rows)


def test_everyone_meets_everyone_in_their_own_group_and_nobody_else():
    client = setup_app_for_tests()
    _, competition_id, ids, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()

    stage = group_stage(client, competition_id)
    membership = {
        row["participant"]["id"]: group["ordinal"]
        for group in stage["groups"]
        for row in group["rows"]
    }
    met: set[frozenset[str]] = set()
    for match in matches(client, competition_id):
        a, b = match["participant_a"]["id"], match["participant_b"]["id"]
        assert membership[a] == membership[b], "a bout was scheduled across groups"
        pair = frozenset((a, b))
        assert pair not in met, "the same pair was scheduled twice"
        met.add(pair)

    for group in stage["groups"]:
        members = [row["participant"]["id"] for row in group["rows"]]
        for a, b in combinations(members, 2):
            assert frozenset((a, b)) in met, "two group members never met"


def test_the_organizers_choice_is_on_record_separately():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers, groups=3, advance=1).raise_for_status()

    journal = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    configured = [e for e in journal if e["event_type"] == "GROUP_STAGE_CONFIGURED"]
    assert len(configured) == 1
    assert configured[0]["payload"]["group_count"] == 3
    assert configured[0]["payload"]["advance_per_group"] == 1
    # Whether the organizer went against the recommendation is recorded too.
    assert "organizer_overrode_suggestion" in configured[0]["payload"]
    assert [e for e in journal if e["event_type"] == "GROUP_STAGE_GENERATED"]


def test_a_group_that_advances_everyone_is_refused():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    refused = generate_groups(client, competition_id, headers, groups=3, advance=3)
    assert refused.status_code == 400, refused.text


def test_a_second_generation_is_refused():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()
    again = generate_groups(client, competition_id, headers)
    assert again.status_code == 409, again.text


def test_a_knockout_discipline_has_no_group_stage():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(
        client, [(f"Боец{i}", f"Клуб{i}") for i in range(1, 9)],
        competition_format="SINGLE_ELIMINATION",
    )
    refused = generate_groups(client, competition_id, headers)
    assert refused.status_code == 400, refused.text


def test_a_round_robin_discipline_is_one_group():
    client = setup_app_for_tests()
    _, competition_id, _, headers = bootstrap(
        client, [(f"Боец{i}", f"Клуб{i}") for i in range(1, 6)], competition_format="ROUND_ROBIN"
    )
    assert generate_groups(client, competition_id, headers, groups=2, advance=1).status_code == 400
    assert generate_groups(client, competition_id, headers, groups=1, advance=4).status_code == 201


def test_clubmates_are_dealt_into_different_groups():
    client = setup_app_for_tests()
    people = [
        ("Иван", "Буза"),
        ("Сергей", "Буза"),
        ("Пётр", "Сокол"),
        ("Фёдор", "Сокол"),
        ("Гриша", "Ратник"),
        ("Тихон", "Ратник"),
    ]
    _, competition_id, _, headers = bootstrap(client, people)
    generated = generate_groups(client, competition_id, headers, groups=2, advance=2)
    assert generated.status_code == 201, generated.text
    assert generated.json()["separation_satisfied"] is True


# --------------------------------------------------------------- the standings


def test_the_table_counts_results_and_marks_who_goes_through():
    client = setup_app_for_tests()
    _, competition_id, ids, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()
    play_group_stage(client, competition_id, [f"Боец{i}" for i in range(1, 10)], ids)

    stage = group_stage(client, competition_id)
    assert stage["matches_finished"] == 16
    assert stage["decided"] is True
    for group in stage["groups"]:
        assert group["complete"] is True
        assert [row["rank"] for row in group["rows"]] == list(range(1, len(group["rows"]) + 1))
        assert sum(1 for row in group["rows"] if row["qualifies"]) == 3
        # Counts only. No points column exists to invent.
        top = group["rows"][0]
        assert top["wins"] + top["losses"] == top["played"]


def test_an_unfinished_group_is_never_decided():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()
    stage = group_stage(client, competition_id)
    assert stage["decided"] is False
    assert all(group["decided"] is False for group in stage["groups"])


# ----------------------------------------------------------------- tie-breaks


def three_way_cycle(client):
    """A group of three whose results form А→Б→В→А: no honest order exists."""
    _, competition_id, ids, headers = bootstrap(
        client, [("Иван", "Буза"), ("Пётр", "Сокол"), ("Сергей", "Ратник")]
    )
    generate_groups(client, competition_id, headers, groups=1, advance=2).raise_for_status()
    beats = {("Иван", "Пётр"), ("Пётр", "Сергей"), ("Сергей", "Иван")}
    for match in matches(client, competition_id):
        a = match["participant_a"]["display_name"]
        b = match["participant_b"]["display_name"]
        winner = a if (a, b) in beats else b
        record(client, match["id"], ids[winner])
    return competition_id, ids, headers


def test_a_cycle_is_reported_not_broken():
    client = setup_app_for_tests()
    competition_id, _, _ = three_way_cycle(client)

    group = group_stage(client, competition_id)["groups"][0]
    assert group["complete"] is True
    assert group["decided"] is False
    assert len(group["unresolved"]) == 1
    assert len(group["unresolved"][0]["participant_ids"]) == 3
    # Nobody is given a place the results did not produce.
    assert all(row["rank"] is None for row in group["rows"])
    assert all(row["qualifies"] is False for row in group["rows"])


def test_a_cycle_blocks_the_playoff():
    client = setup_app_for_tests()
    competition_id, _, headers = three_way_cycle(client)

    state = client.get(f"/api/v1/competitions/{competition_id}/qualification").json()
    assert state["ready"] is False
    assert "TIE_UNRESOLVED" in {blocker["code"] for blocker in state["blockers"]}

    refused = client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    )
    assert refused.status_code == 409, refused.text


def test_the_organizer_settles_the_cycle_with_a_reason():
    client = setup_app_for_tests()
    competition_id, ids, headers = three_way_cycle(client)
    group_id = group_stage(client, competition_id)["groups"][0]["id"]

    resolved = client.post(
        f"/api/v1/competition-groups/{group_id}/tie-break",
        json={
            "ordering": [ids["Сергей"], ids["Иван"], ids["Пётр"]],
            "reason": "Решение судейской коллегии по качеству побед",
        },
        headers=headers,
    )
    assert resolved.status_code == 200, resolved.text
    group = resolved.json()["groups"][0]
    assert group["decided"] is True
    assert [row["participant"]["display_name"] for row in group["rows"]] == [
        "Сергей",
        "Иван",
        "Пётр",
    ]
    assert {row["resolved_by"] for row in group["rows"]} == {"MANUAL"}

    journal = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    decision = [e for e in journal if e["event_type"] == "GROUP_TIE_RESOLVED"]
    assert len(decision) == 1
    assert decision[0]["payload"]["reason"].startswith("Решение судейской")


def test_a_tie_break_needs_a_reason_and_real_members():
    client = setup_app_for_tests()
    competition_id, ids, headers = three_way_cycle(client)
    group_id = group_stage(client, competition_id)["groups"][0]["id"]

    blank = client.post(
        f"/api/v1/competition-groups/{group_id}/tie-break",
        json={"ordering": [ids["Иван"], ids["Пётр"]], "reason": ""},
        headers=headers,
    )
    assert blank.status_code == 422, blank.text

    stray = client.post(
        f"/api/v1/competition-groups/{group_id}/tie-break",
        json={
            "ordering": [ids["Иван"], "00000000-0000-0000-0000-000000000001"],
            "reason": "Кто угодно",
        },
        headers=headers,
    )
    assert stray.status_code == 400, stray.text


# ------------------------------------------------------------- qualification


def test_qualifiers_are_cross_seeded_into_the_playoff():
    client = setup_app_for_tests()
    _, competition_id, ids, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()
    play_group_stage(client, competition_id, [f"Боец{i}" for i in range(1, 10)], ids)

    state = client.get(f"/api/v1/competitions/{competition_id}/qualification").json()
    assert state["ready"] is True
    assert state["blockers"] == []
    # Winners first, then runners-up, then thirds — that ordering *is* the
    # cross-seeding once `standard_seed_order` lays it out.
    places = [q["place_in_group"] for q in state["qualifiers"]]
    assert places == [1, 1, 2, 2, 3, 3]
    assert [q["seed"] for q in state["qualifiers"]] == [1, 2, 3, 4, 5, 6]
    assert state["plan"]["bracket_size"] == 8
    assert state["plan"]["bye_count"] == 2

    built = client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    )
    assert built.status_code == 201, built.text

    playoff = [row for row in matches(client, competition_id) if row["stage"] != "GROUP"]
    assert {row["stage"] for row in playoff} == {"QUARTERFINAL", "SEMIFINAL", "FINAL"}

    # The two group winners were given the byes, and no first-round pair is
    # from one group.
    quarters = [row for row in playoff if row["stage"] == "QUARTERFINAL"]
    winners = {q["participant_id"] for q in state["qualifiers"] if q["place_in_group"] == 1}
    byes = [row for row in quarters if row["is_bye"]]
    assert len(byes) == 2
    assert {row["winner_id"] for row in byes} == winners

    group_of = {q["participant_id"]: q["group_ordinal"] for q in state["qualifiers"]}
    for row in quarters:
        if not row["is_bye"]:
            a, b = row["participant_a"]["id"], row["participant_b"]["id"]
            assert group_of[a] != group_of[b], "group mates met in the first playoff round"


def test_an_unplayed_group_blocks_the_playoff():
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()

    state = client.get(f"/api/v1/competitions/{competition_id}/qualification").json()
    assert state["ready"] is False
    assert "GROUP_STAGE_INCOMPLETE" in {blocker["code"] for blocker in state["blockers"]}

    refused = client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    )
    assert refused.status_code == 409, refused.text


def test_the_playoff_is_built_only_once():
    client = setup_app_for_tests()
    _, competition_id, ids, headers = nine_fighters(client)
    generate_groups(client, competition_id, headers).raise_for_status()
    play_group_stage(client, competition_id, [f"Боец{i}" for i in range(1, 10)], ids)
    client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    ).raise_for_status()

    again = client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    )
    assert again.status_code == 409, again.text
    assert "PLAYOFF_ALREADY_BUILT" in {
        blocker["code"] for blocker in again.json()["detail"]["blockers"]
    }


def test_the_documented_five_fighter_case_works_end_to_end():
    """One round-robin group of five, four advance → 1v4 and 2v3."""
    client = setup_app_for_tests()
    _, competition_id, ids, headers = bootstrap(
        client, [(f"Боец{i}", f"Клуб{i}") for i in range(1, 6)], competition_format="ROUND_ROBIN"
    )
    generate_groups(client, competition_id, headers, groups=1, advance=4).raise_for_status()
    play_group_stage(client, competition_id, [f"Боец{i}" for i in range(1, 6)], ids)

    built = client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    )
    assert built.status_code == 201, built.text
    assert built.json()["bracket_size"] == 4
    assert built.json()["bye_count"] == 0

    semis = [
        row
        for row in matches(client, competition_id)
        if row["stage"] == "SEMIFINAL"
    ]
    pairs = {
        frozenset((row["participant_a"]["display_name"], row["participant_b"]["display_name"]))
        for row in semis
    }
    assert pairs == {frozenset(("Боец1", "Боец4")), frozenset(("Боец2", "Боец3"))}


# ------------------------------------------------------------------- guards


def test_group_writes_require_an_authorized_manager():
    client = setup_app_for_tests()
    _, competition_id, _, _ = nine_fighters(client)

    anonymous = client.post(
        f"/api/v1/competitions/{competition_id}/groups/generate",
        json={"group_count": 2, "advance_per_group": 3},
    )
    assert anonymous.status_code == 401, anonymous.text

    _, stranger = register(client, "stranger@example.com")
    forbidden = generate_groups(client, competition_id, stranger)
    assert forbidden.status_code == 403, forbidden.text


def test_the_configuration_has_no_defaults():
    """The platform must not be able to build a stage nobody specified."""
    client = setup_app_for_tests()
    _, competition_id, _, headers = nine_fighters(client)
    empty = client.post(
        f"/api/v1/competitions/{competition_id}/groups/generate", json={}, headers=headers
    )
    assert empty.status_code == 422, empty.text


# --------------------------------------------------- the whole scenario


def test_nine_entrants_through_groups_a_withdrawal_and_a_champion():
    """The case this feature was asked for, start to finish."""
    client = setup_app_for_tests()
    _, competition_id, ids, headers = nine_fighters(client)

    generate_groups(client, competition_id, headers, groups=2, advance=3).raise_for_status()
    play_group_stage(client, competition_id, [f"Боец{i}" for i in range(1, 10)], ids)

    state = client.get(f"/api/v1/competitions/{competition_id}/qualification").json()
    assert state["ready"] is True
    client.post(
        f"/api/v1/competitions/{competition_id}/playoff/generate", json={}, headers=headers
    ).raise_for_status()

    # Someone pulls out of an unfought quarterfinal; their opponent goes through
    # without the bracket being rebuilt.
    quarters = [
        row
        for row in matches(client, competition_id)
        if row["stage"] == "QUARTERFINAL" and not row["is_bye"]
    ]
    bout = quarters[0]
    leaving = bout["participant_a"]["id"]
    opponent = bout["participant_b"]["id"]
    before = {row["id"] for row in matches(client, competition_id)}

    withdrawal = client.post(
        f"/api/v1/participants/{leaving}/withdraw",
        json={"reason": "Травма"},
        headers=headers,
    )
    assert withdrawal.status_code == 200, withdrawal.text

    after = matches(client, competition_id)
    assert {row["id"] for row in after} == before, "the bracket must not be rebuilt"
    settled = next(row for row in after if row["id"] == bout["id"])
    assert settled["status"] == "FINISHED"
    assert settled["winner_id"] == opponent

    # Play out whatever remains, oldest round first, and a champion appears.
    for _ in range(6):
        pending = [
            row
            for row in matches(client, competition_id)
            if row["stage"] != "GROUP"
            and row["status"] != "FINISHED"
            and row["participant_a"]
            and row["participant_b"]
        ]
        if not pending:
            break
        for row in pending:
            record(client, row["id"], row["participant_a"]["id"])

    champion = client.get(f"/api/v1/competitions/{competition_id}/champion").json()
    assert champion["complete"] is True
    assert champion["champion"] is not None
