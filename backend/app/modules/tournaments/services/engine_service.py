from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete
from app.modules.tournaments.models import (
    Bracket,
    Competition,
    CompetitionEvent,
    Draw,
    Match,
    MatchResult,
    Participant,
    ParticipantStatusHistory,
    Team,
    TeamMember,
    Tournament,
    TournamentCategory,
)


def parse_id(value: str, label: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} id") from None


class TournamentEngineService:
    @staticmethod
    async def competition(session: AsyncSession, competition_id: str) -> Competition:
        item = await session.get(Competition, parse_id(competition_id, "competition"))
        if item is None:
            raise HTTPException(status_code=404, detail="Competition not found")
        return item

    @staticmethod
    async def create_competition(session: AsyncSession, **data) -> Competition:
        tournament = await session.get(Tournament, parse_id(data["tournament_id"], "tournament"))
        if tournament is None:
            raise HTTPException(status_code=404, detail="Tournament not found")
        item = Competition(tournament_id=tournament.id, name=data["name"], description=data.get("description"), competition_type=data["type"], format=data["format"], status=data["status"])
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_team(session: AsyncSession, **data) -> Team:
        competition = await TournamentEngineService.competition(session, data["competition_id"])
        if competition.competition_type != "TEAM":
            raise HTTPException(status_code=400, detail="Teams are only allowed in team competitions")
        item = Team(competition_id=competition.id, name=data["name"], short_name=data.get("short_name"), club_id=parse_id(data["club_id"], "club") if data.get("club_id") else None, captain_id=parse_id(data["captain_id"], "captain") if data.get("captain_id") else None)
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_team_member(session: AsyncSession, **data) -> TeamMember:
        team = await session.get(Team, parse_id(data["team_id"], "team"))
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        athlete = await session.get(Athlete, parse_id(data["athlete_id"], "athlete"))
        if athlete is None:
            raise HTTPException(status_code=404, detail="Athlete not found")
        item = TeamMember(team_id=team.id, athlete_id=athlete.id, role=data.get("role"))
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_participant(session: AsyncSession, **data) -> Participant:
        competition = await TournamentEngineService.competition(session, data["competition_id"])
        athlete_id = parse_id(data["athlete_id"], "athlete") if data.get("athlete_id") else None
        team_id = parse_id(data["team_id"], "team") if data.get("team_id") else None
        if competition.competition_type == "INDIVIDUAL" and athlete_id is None and not data.get("display_name"):
            # An entrant who already has a platform profile must be *linked* to
            # it (``athlete_id``) so no duplicate identity is created. Someone
            # with no profile at all is still a legitimate entrant and is
            # recorded by name on the entry itself.
            raise HTTPException(
                status_code=400,
                detail="Individual participant requires a linked athlete or a display name",
            )
        if competition.competition_type == "TEAM" and team_id is None:
            raise HTTPException(status_code=400, detail="Team participant requires a team")
        if athlete_id is not None and await session.get(Athlete, athlete_id) is None:
            raise HTTPException(status_code=404, detail="Athlete not found")
        if team_id is not None:
            team = await session.get(Team, team_id)
            if team is None or team.competition_id != competition.id:
                raise HTTPException(status_code=404, detail="Team not found in competition")
        category = await session.scalar(select(TournamentCategory).where(TournamentCategory.tournament_id == competition.tournament_id).order_by(TournamentCategory.created_at.asc()))
        item = Participant(
            tournament_id=competition.tournament_id,
            category_id=category.id if category else None,
            competition_id=competition.id,
            athlete_id=athlete_id,
            team_id=team_id,
            seed=data.get("seed"),
            status=data["status"],
            city=data.get("city"),
            club_id=parse_id(data["club_id"], "club") if data.get("club_id") else None,
            club_name=data.get("club_name"),
            # Only meaningful for an entrant with no athlete profile; when one is
            # linked the read side resolves the name from that profile instead.
            display_name=data.get("display_name") if athlete_id is None else None,
        )
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_draw(session: AsyncSession, **data) -> Draw:
        competition = await TournamentEngineService.competition(session, data["competition_id"])
        item = Draw(competition_id=competition.id, name=data["name"], draw_type=data["type"], status=data["status"])
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_bracket(session: AsyncSession, **data) -> Bracket:
        competition = await TournamentEngineService.competition(session, data["competition_id"])
        draw_id = parse_id(data["draw_id"], "draw") if data.get("draw_id") else None
        if draw_id is not None:
            draw = await session.get(Draw, draw_id)
            if draw is None or draw.competition_id != competition.id:
                raise HTTPException(status_code=404, detail="Draw not found in competition")
        item = Bracket(competition_id=competition.id, draw_id=draw_id, name=data["name"], stage_type="PLAYOFF" if isinstance(data["round"], str) else "ROUND", round=str(data["round"]), position=data["position"])
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_match(session: AsyncSession, **data) -> Match:
        competition = await TournamentEngineService.competition(session, data["competition_id"])
        category = await session.scalar(select(TournamentCategory).where(TournamentCategory.tournament_id == competition.tournament_id).order_by(TournamentCategory.created_at.asc()))
        draw_id = parse_id(data["draw_id"], "draw") if data.get("draw_id") else None
        bracket_id = parse_id(data["bracket_id"], "bracket") if data.get("bracket_id") else None
        if draw_id and (await session.get(Draw, draw_id) is None):
            raise HTTPException(status_code=404, detail="Draw not found")
        if bracket_id and (await session.get(Bracket, bracket_id) is None):
            raise HTTPException(status_code=404, detail="Bracket not found")
        item = Match(tournament_id=competition.tournament_id, category_id=category.id if category else None, competition_id=competition.id, draw_id=draw_id, bracket_id=bracket_id, participant_red_id=parse_id(data["participant_a_id"], "participant") if data.get("participant_a_id") else None, participant_blue_id=parse_id(data["participant_b_id"], "participant") if data.get("participant_b_id") else None, stage_name=data["stage"], status="IN_PROGRESS" if data["status"] == "RUNNING" else data["status"])
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_result(session: AsyncSession, **data) -> MatchResult:
        match = await session.get(Match, parse_id(data["match_id"], "match"))
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        if await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id)) is not None:
            raise HTTPException(status_code=409, detail="Match already has a result")
        if data.get("winner_id"):
            winner = await session.get(Participant, parse_id(data["winner_id"], "winner participant"))
            if winner is None or winner.tournament_id != match.tournament_id or winner.id not in {match.participant_red_id, match.participant_blue_id}:
                raise HTTPException(status_code=404, detail="Winner participant not found")
        item = MatchResult(match_id=match.id, winner_participant_id=parse_id(data["winner_id"], "winner participant") if data.get("winner_id") else None, result_type=data["method"], notes=data.get("comment"))
        match.status = "FINISHED"
        match.winner_id = item.winner_participant_id
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_status_history(session: AsyncSession, **data) -> ParticipantStatusHistory:
        participant = await session.get(Participant, parse_id(data["participant_id"], "participant"))
        if participant is None:
            raise HTTPException(status_code=404, detail="Participant not found")
        item = ParticipantStatusHistory(participant_id=participant.id, from_status=participant.status, to_status=data["new_status"], reason=data.get("reason"))
        participant.status = data["new_status"]
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def create_event(session: AsyncSession, **data) -> CompetitionEvent:
        competition = await TournamentEngineService.competition(session, data["competition_id"])
        item = CompetitionEvent(competition_id=competition.id, event_type=data["event_type"], description=data.get("description"), payload=data.get("payload"))
        session.add(item)
        await session.flush()
        return item

    @staticmethod
    async def _log(session: AsyncSession, match: Match, event_type: str, description: str, payload: dict) -> None:
        """Append to the competition journal, when the match belongs to one."""
        if match.competition_id is None:
            return
        session.add(
            CompetitionEvent(
                competition_id=match.competition_id,
                event_type=event_type,
                description=description,
                payload=payload,
            )
        )

    @staticmethod
    async def update_result(session: AsyncSession, match_id: str, **data) -> MatchResult:
        """Correct an already recorded result.

        ``docs/tournament-engine.md`` asks for fast result changes, while the
        architecture guardrails forbid losing history. The previous values are
        therefore copied into a ``MATCH_UPDATED`` competition event before the
        row is rewritten.
        """
        match = await session.get(Match, parse_id(match_id, "match"))
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        result = await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id))
        if result is None:
            raise HTTPException(status_code=404, detail="Match has no result to update")

        winner_id = None
        if data.get("winner_id"):
            winner_id = parse_id(data["winner_id"], "winner participant")
            winner = await session.get(Participant, winner_id)
            if winner is None or winner.tournament_id != match.tournament_id or winner.id not in {match.participant_red_id, match.participant_blue_id}:
                raise HTTPException(status_code=404, detail="Winner participant not found")

        previous = {
            "winner_id": str(result.winner_participant_id) if result.winner_participant_id else None,
            "method": result.result_type,
            "comment": result.notes,
            "recorded_at": result.recorded_at.isoformat(),
        }

        result.winner_participant_id = winner_id
        result.result_type = data["method"]
        result.notes = data.get("comment")
        result.recorded_at = datetime.now(timezone.utc)
        match.status = "FINISHED"
        match.winner_id = winner_id

        await TournamentEngineService._log(
            session,
            match,
            "MATCH_UPDATED",
            data.get("reason") or "Match result corrected",
            {
                "match_id": str(match.id),
                "previous_result": previous,
                "new_result": {
                    "winner_id": str(winner_id) if winner_id else None,
                    "method": result.result_type,
                    "comment": result.notes,
                },
                "reason": data.get("reason"),
            },
        )
        await session.flush()
        return result

    @staticmethod
    async def update_match_status(session: AsyncSession, match_id: str, *, new_status: str, reason: str | None = None) -> Match:
        match = await session.get(Match, parse_id(match_id, "match"))
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")

        normalized = str(new_status).upper()
        if normalized == "RUNNING":
            normalized = "IN_PROGRESS"
        if normalized not in {"SCHEDULED", "IN_PROGRESS", "FINISHED", "CANCELLED"}:
            raise HTTPException(status_code=400, detail="Invalid match status")
        if normalized == "FINISHED":
            existing = await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id))
            if existing is None:
                raise HTTPException(status_code=400, detail="Record a result before finishing the match")

        previous_status = match.status
        match.status = normalized
        await TournamentEngineService._log(
            session,
            match,
            "MATCH_UPDATED",
            reason or f"Match status {previous_status} -> {normalized}",
            {"match_id": str(match.id), "previous_status": previous_status, "new_status": normalized, "reason": reason},
        )
        await session.flush()
        return match
