"""Read endpoints for the tournament engine.

``engine.py`` is write-only; without these a client can create a competition
but never render one. Everything here is a projection over existing tables —
no new persistence, no new domain rules.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.tournaments.schemas.views import (
    AthleteParticipationView,
    BracketTreeView,
    BracketView,
    CompetitionEventView,
    CompetitionView,
    DrawView,
    MatchResultUpdateRequest,
    MatchResultView,
    MatchStatusUpdateRequest,
    MatchView,
    ParticipantStatusHistoryView,
    ParticipantView,
    StandingsView,
    TeamView,
)
from app.modules.tournaments.services.engine_service import TournamentEngineService
from app.modules.tournaments.services.read_service import TournamentReadService

router = APIRouter(prefix="/api/v1", tags=["tournament-engine"])


@router.get("/tournaments/{tournament_id}/competitions", response_model=list[CompetitionView])
async def list_tournament_competitions(tournament_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_competitions(session, tournament_id)


@router.get("/competitions/{competition_id}", response_model=CompetitionView)
async def get_competition(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.competition_detail(session, competition_id)


@router.get("/competitions/{competition_id}/participants", response_model=list[ParticipantView])
async def list_competition_participants(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_participants(session, competition_id)


@router.get("/competitions/{competition_id}/teams", response_model=list[TeamView])
async def list_competition_teams(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_teams(session, competition_id)


@router.get("/competitions/{competition_id}/matches", response_model=list[MatchView])
async def list_competition_matches(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_competition_matches(session, competition_id)


@router.get("/competitions/{competition_id}/standings", response_model=StandingsView)
async def get_standings(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.standings(session, competition_id)


@router.get("/competitions/{competition_id}/bracket", response_model=BracketTreeView)
async def get_bracket_tree(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.bracket_tree(session, competition_id)


@router.get("/competitions/{competition_id}/draws", response_model=list[DrawView])
async def list_competition_draws(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_draws(session, competition_id)


@router.get("/competitions/{competition_id}/brackets", response_model=list[BracketView])
async def list_competition_brackets(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_brackets(session, competition_id)


@router.get("/competitions/{competition_id}/events", response_model=list[CompetitionEventView])
async def list_competition_events(competition_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_events(session, competition_id)


@router.get("/competition-matches/{match_id}", response_model=MatchView)
async def get_match(match_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.match_detail(session, match_id)


@router.get("/matches/{match_id}/result", response_model=MatchResultView)
async def get_match_result(match_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.match_result(session, match_id)


@router.put("/matches/{match_id}/result", response_model=MatchResultView)
async def update_match_result(
    match_id: str,
    payload: MatchResultUpdateRequest,
    session: AsyncSession = Depends(get_db),
):
    await TournamentEngineService.update_result(session, match_id, **payload.model_dump())
    await session.commit()
    return await TournamentReadService.match_result(session, match_id)


@router.patch("/competition-matches/{match_id}/status", response_model=MatchView)
async def update_match_status(
    match_id: str,
    payload: MatchStatusUpdateRequest,
    session: AsyncSession = Depends(get_db),
):
    await TournamentEngineService.update_match_status(
        session, match_id, new_status=payload.status, reason=payload.reason
    )
    await session.commit()
    return await TournamentReadService.match_detail(session, match_id)


@router.get("/participants/{participant_id}/status-history", response_model=list[ParticipantStatusHistoryView])
async def list_participant_status_history(participant_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.list_status_history(session, participant_id)


@router.get("/athletes/{athlete_id}/tournament-history", response_model=list[AthleteParticipationView])
async def get_athlete_tournament_history(athlete_id: str, session: AsyncSession = Depends(get_db)):
    return await TournamentReadService.athlete_history(session, athlete_id)
