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


def register_athlete(client, email: str, nickname: str) -> tuple[str, str]:
    """Register a user, read back its id and attach an athlete profile."""
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": nickname, "last_name": "Fighter"},
    )
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]
    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    user_id = me.json()["id"]

    athlete = client.post(
        "/api/v1/athletes",
        json={"user_id": user_id, "nickname": nickname, "experience_years": 2, "level": "PRACTITIONER"},
    )
    assert athlete.status_code == 201, athlete.text
    return user_id, athlete.json()["id"]


def bootstrap_competition(client, *, competition_format: str, athlete_count: int):
    organizer_id, _ = register_athlete(client, "organizer@example.com", "Organizer")

    ruleset = client.post(
        "/api/v1/rulesets",
        json={"title": "Base ruleset", "version": "1.0", "status": "ACTIVE"},
    )
    assert ruleset.status_code == 201, ruleset.text

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Views Cup",
            "status": "RUNNING",
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
            "name": "Men weapon",
            "type": "INDIVIDUAL",
            "format": competition_format,
            "status": "RUNNING",
        },
    )
    assert competition.status_code == 201, competition.text
    competition_id = competition.json()["id"]

    participant_ids = []
    for index in range(athlete_count):
        _, athlete_id = register_athlete(client, f"fighter{index}@example.com", f"Fighter{index}")
        participant = client.post(
            f"/api/v1/competitions/{competition_id}/participants",
            json={"competition_id": competition_id, "athlete_id": athlete_id, "seed": index + 1},
        )
        assert participant.status_code == 201, participant.text
        participant_ids.append(participant.json()["id"])

    return tournament_id, competition_id, participant_ids


def test_competition_views_expose_resolved_names():
    client = setup_app_for_tests()
    tournament_id, competition_id, participant_ids = bootstrap_competition(
        client, competition_format="ROUND_ROBIN", athlete_count=3
    )

    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions")
    assert competitions.status_code == 200, competitions.text
    assert len(competitions.json()) == 1
    assert competitions.json()[0]["participant_count"] == 3

    participants = client.get(f"/api/v1/competitions/{competition_id}/participants")
    assert participants.status_code == 200, participants.text
    names = [p["display_name"] for p in participants.json()]
    assert names == ["Fighter0", "Fighter1", "Fighter2"]
    assert all(p["type"] == "ATHLETE" for p in participants.json())

    detail = client.get(f"/api/v1/competitions/{competition_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["format"] == "ROUND_ROBIN"

    assert client.get("/api/v1/competitions/not-a-uuid").status_code == 400


def test_round_robin_standings_count_recorded_results_only():
    client = setup_app_for_tests()
    _, competition_id, participants = bootstrap_competition(
        client, competition_format="ROUND_ROBIN", athlete_count=3
    )
    a, b, c = participants

    def create_match(left: str, right: str) -> str:
        response = client.post(
            "/api/v1/competition-matches",
            json={
                "competition_id": competition_id,
                "participant_a_id": left,
                "participant_b_id": right,
                "stage": "GROUP",
            },
        )
        assert response.status_code == 201, response.text
        return response.json()["id"]

    match_ab = create_match(a, b)
    match_ac = create_match(a, c)
    create_match(b, c)  # deliberately left without a result

    for match_id, winner in ((match_ab, a), (match_ac, a)):
        recorded = client.post(
            f"/api/v1/matches/{match_id}/result",
            json={"match_id": match_id, "winner_id": winner, "method": "JUDGE_DECISION"},
        )
        assert recorded.status_code == 201, recorded.text

    standings = client.get(f"/api/v1/competitions/{competition_id}/standings")
    assert standings.status_code == 200, standings.text
    body = standings.json()

    assert body["matches_total"] == 3
    assert body["matches_finished"] == 2
    assert body["provisional"] is True

    leader = body["rows"][0]
    assert leader["participant"]["id"] == a
    assert leader["wins"] == 2
    assert leader["played"] == 2
    assert leader["no_results"] == 0

    # b and c each lost/played once or not at all; nobody else has a win.
    assert all(row["wins"] == 0 for row in body["rows"][1:])
    # The unplayed b-c match is tracked, not silently dropped.
    assert sum(row["no_results"] for row in body["rows"]) == 2


def test_bracket_tree_groups_matches_by_round():
    client = setup_app_for_tests()
    _, competition_id, participants = bootstrap_competition(
        client, competition_format="SINGLE_ELIMINATION", athlete_count=4
    )

    draw = client.post(
        f"/api/v1/competitions/{competition_id}/draws",
        json={"competition_id": competition_id, "name": "Main draw", "type": "SEEDED"},
    )
    assert draw.status_code == 201, draw.text
    draw_id = draw.json()["id"]

    def create_bracket(name: str, round_value, position: int) -> str:
        response = client.post(
            f"/api/v1/competitions/{competition_id}/brackets",
            json={
                "competition_id": competition_id,
                "draw_id": draw_id,
                "name": name,
                "round": round_value,
                "position": position,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()["id"]

    semi_a = create_bracket("Semifinal A", "SEMIFINAL", 1)
    semi_b = create_bracket("Semifinal B", "SEMIFINAL", 2)
    final = create_bracket("Final", "FINAL", 1)

    def create_match(bracket_id: str, left: str | None, right: str | None, stage: str) -> str:
        response = client.post(
            "/api/v1/competition-matches",
            json={
                "competition_id": competition_id,
                "draw_id": draw_id,
                "bracket_id": bracket_id,
                "participant_a_id": left,
                "participant_b_id": right,
                "stage": stage,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()["id"]

    create_match(semi_a, participants[0], participants[3], "SEMIFINAL")
    create_match(semi_b, participants[1], participants[2], "SEMIFINAL")
    create_match(final, None, None, "FINAL")

    tree = client.get(f"/api/v1/competitions/{competition_id}/bracket")
    assert tree.status_code == 200, tree.text
    body = tree.json()

    assert [r["key"] for r in body["rounds"]] == ["SEMIFINAL", "FINAL"]
    assert len(body["rounds"][0]["matches"]) == 2
    assert len(body["rounds"][1]["matches"]) == 1
    assert body["unassigned"] == []
    # Bracket slots carry the resolved fighter names, not bare ids.
    assert body["rounds"][0]["matches"][0]["participant_a"]["display_name"] == "Fighter0"
    assert body["rounds"][1]["matches"][0]["participant_a"] is None


def test_result_update_keeps_previous_value_in_the_journal():
    client = setup_app_for_tests()
    _, competition_id, participants = bootstrap_competition(
        client, competition_format="SINGLE_ELIMINATION", athlete_count=2
    )
    a, b = participants

    match = client.post(
        "/api/v1/competition-matches",
        json={
            "competition_id": competition_id,
            "participant_a_id": a,
            "participant_b_id": b,
            "stage": "FINAL",
        },
    )
    assert match.status_code == 201, match.text
    match_id = match.json()["id"]

    created = client.post(
        f"/api/v1/matches/{match_id}/result",
        json={"match_id": match_id, "winner_id": a, "method": "JUDGE_DECISION"},
    )
    assert created.status_code == 201, created.text

    # Re-posting is still rejected: corrections go through PUT.
    duplicate = client.post(
        f"/api/v1/matches/{match_id}/result",
        json={"match_id": match_id, "winner_id": b, "method": "JUDGE_DECISION"},
    )
    assert duplicate.status_code == 409, duplicate.text

    corrected = client.put(
        f"/api/v1/matches/{match_id}/result",
        json={"winner_id": b, "method": "DISQUALIFICATION", "reason": "Judges revised the decision"},
    )
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["winner_id"] == b
    assert corrected.json()["method"] == "DISQUALIFICATION"

    detail = client.get(f"/api/v1/competition-matches/{match_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["winner_id"] == b
    assert detail.json()["status"] == "FINISHED"

    events = client.get(f"/api/v1/competitions/{competition_id}/events")
    assert events.status_code == 200, events.text
    updates = [e for e in events.json() if e["event_type"] == "MATCH_UPDATED"]
    assert len(updates) == 1
    assert updates[0]["payload"]["previous_result"]["winner_id"] == a
    assert updates[0]["payload"]["new_result"]["winner_id"] == b


def test_match_status_update_requires_a_result_before_finishing():
    client = setup_app_for_tests()
    _, competition_id, participants = bootstrap_competition(
        client, competition_format="SINGLE_ELIMINATION", athlete_count=2
    )
    a, b = participants

    match = client.post(
        "/api/v1/competition-matches",
        json={"competition_id": competition_id, "participant_a_id": a, "participant_b_id": b, "stage": "FINAL"},
    )
    assert match.status_code == 201, match.text
    match_id = match.json()["id"]

    started = client.patch(f"/api/v1/competition-matches/{match_id}/status", json={"status": "RUNNING"})
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "IN_PROGRESS"

    premature = client.patch(f"/api/v1/competition-matches/{match_id}/status", json={"status": "FINISHED"})
    assert premature.status_code == 400, premature.text

    cancelled = client.patch(
        f"/api/v1/competition-matches/{match_id}/status",
        json={"status": "CANCELLED", "reason": "Both fighters withdrew"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "CANCELLED"


def test_athlete_history_reports_champion_finalist_and_standings():
    client = setup_app_for_tests()
    organizer_id, _ = register_athlete(client, "organizer2@example.com", "Organizer2")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Rules", "version": "1.0", "status": "ACTIVE"})
    assert ruleset.status_code == 201, ruleset.text

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "History Cup",
            "status": "RUNNING",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    se_competition = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={
            "tournament_id": tournament_id,
            "name": "Final Four",
            "type": "INDIVIDUAL",
            "format": "SINGLE_ELIMINATION",
            "status": "RUNNING",
        },
    )
    assert se_competition.status_code == 201, se_competition.text
    se_id = se_competition.json()["id"]

    _, champ_athlete = register_athlete(client, "champ@example.com", "Champ")
    _, runner_athlete = register_athlete(client, "runner@example.com", "Runner")

    champ_p = client.post(
        f"/api/v1/competitions/{se_id}/participants",
        json={"competition_id": se_id, "athlete_id": champ_athlete},
    ).json()["id"]
    runner_p = client.post(
        f"/api/v1/competitions/{se_id}/participants",
        json={"competition_id": se_id, "athlete_id": runner_athlete},
    ).json()["id"]

    final_match = client.post(
        "/api/v1/competition-matches",
        json={
            "competition_id": se_id,
            "participant_a_id": champ_p,
            "participant_b_id": runner_p,
            "stage": "FINAL",
        },
    ).json()["id"]
    finished = client.post(
        f"/api/v1/matches/{final_match}/result",
        json={"match_id": final_match, "winner_id": champ_p, "method": "JUDGE_DECISION"},
    )
    assert finished.status_code == 201, finished.text

    rr_competition = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={
            "tournament_id": tournament_id,
            "name": "Group stage",
            "type": "INDIVIDUAL",
            "format": "ROUND_ROBIN",
            "status": "RUNNING",
        },
    )
    assert rr_competition.status_code == 201, rr_competition.text
    rr_id = rr_competition.json()["id"]

    champ_p2 = client.post(
        f"/api/v1/competitions/{rr_id}/participants",
        json={"competition_id": rr_id, "athlete_id": champ_athlete},
    ).json()["id"]
    _, third_athlete = register_athlete(client, "third@example.com", "Third")
    third_p = client.post(
        f"/api/v1/competitions/{rr_id}/participants",
        json={"competition_id": rr_id, "athlete_id": third_athlete},
    ).json()["id"]

    rr_match = client.post(
        "/api/v1/competition-matches",
        json={"competition_id": rr_id, "participant_a_id": champ_p2, "participant_b_id": third_p, "stage": "GROUP"},
    ).json()["id"]
    rr_result = client.post(
        f"/api/v1/matches/{rr_match}/result",
        json={"match_id": rr_match, "winner_id": champ_p2, "method": "JUDGE_DECISION"},
    )
    assert rr_result.status_code == 201, rr_result.text

    history = client.get(f"/api/v1/athletes/{champ_athlete}/tournament-history")
    assert history.status_code == 200, history.text
    body = history.json()
    assert len(body) == 2
    by_competition = {row["competition_id"]: row for row in body}
    assert by_competition[se_id]["outcome"] == "CHAMPION"
    assert by_competition[se_id]["tournament_title"] == "History Cup"
    assert by_competition[rr_id]["outcome"] == "STANDINGS"
    assert by_competition[rr_id]["standings_wins"] == 1
    assert by_competition[rr_id]["standings_losses"] == 0

    runner_history = client.get(f"/api/v1/athletes/{runner_athlete}/tournament-history")
    assert runner_history.status_code == 200, runner_history.text
    assert runner_history.json()[0]["outcome"] == "FINALIST"

    assert client.get("/api/v1/athletes/not-a-uuid/tournament-history").status_code == 400


def test_team_competition_views_include_members_and_history():
    client = setup_app_for_tests()
    organizer_id, _ = register_athlete(client, "organizer@example.com", "Organizer")

    ruleset = client.post(
        "/api/v1/rulesets",
        json={"title": "Base ruleset", "version": "1.0", "status": "ACTIVE"},
    )
    assert ruleset.status_code == 201, ruleset.text

    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Team Cup",
            "status": "RUNNING",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    competition = client.post(
        f"/api/v1/tournaments/{tournament_id}/competitions",
        json={"tournament_id": tournament_id, "name": "Teams 3x3", "type": "TEAM", "format": "GROUP_PLAYOFF"},
    )
    assert competition.status_code == 201, competition.text
    competition_id = competition.json()["id"]

    team = client.post(
        f"/api/v1/competitions/{competition_id}/teams",
        json={"competition_id": competition_id, "name": "Novgorod", "short_name": "NOV"},
    )
    assert team.status_code == 201, team.text
    team_id = team.json()["id"]

    _, athlete_id = register_athlete(client, "member@example.com", "Member")
    member = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"team_id": team_id, "athlete_id": athlete_id, "role": "CAPTAIN"},
    )
    assert member.status_code == 201, member.text

    teams = client.get(f"/api/v1/competitions/{competition_id}/teams")
    assert teams.status_code == 200, teams.text
    assert teams.json()[0]["name"] == "Novgorod"
    assert teams.json()[0]["members"][0]["display_name"] == "Member"
    assert teams.json()[0]["members"][0]["role"] == "CAPTAIN"

    participant = client.post(
        f"/api/v1/competitions/{competition_id}/participants",
        json={"competition_id": competition_id, "team_id": team_id},
    )
    assert participant.status_code == 201, participant.text
    participant_id = participant.json()["id"]

    participants = client.get(f"/api/v1/competitions/{competition_id}/participants")
    assert participants.status_code == 200, participants.text
    assert participants.json()[0]["type"] == "TEAM"
    assert participants.json()[0]["display_name"] == "Novgorod"

    withdrawal = client.post(
        "/api/v1/participant-status-history",
        json={"participant_id": participant_id, "new_status": "WITHDRAWN", "reason": "Injury"},
    )
    assert withdrawal.status_code == 201, withdrawal.text

    history = client.get(f"/api/v1/participants/{participant_id}/status-history")
    assert history.status_code == 200, history.text
    assert history.json()[0]["old_status"] == "REGISTERED"
    assert history.json()[0]["new_status"] == "WITHDRAWN"
    assert history.json()[0]["reason"] == "Injury"
