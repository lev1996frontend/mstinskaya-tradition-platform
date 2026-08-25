from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.tournaments.schemas.engine import *
from app.modules.tournaments.services.engine_service import TournamentEngineService

router = APIRouter(prefix="/api/v1", tags=["tournament-engine"])


def commit_response(session, item):
    return item


@router.post("/competitions", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
async def create_competition(payload: CompetitionCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_competition(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/tournaments/{tournament_id}/competitions", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament_competition(tournament_id: str, payload: CompetitionCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["tournament_id"] = tournament_id
    item = await TournamentEngineService.create_competition(session, **data)
    await session.commit()
    return item


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(payload: TeamCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_team(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/competitions/{competition_id}/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_competition_team(competition_id: str, payload: TeamCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["competition_id"] = competition_id
    item = await TournamentEngineService.create_team(session, **data)
    await session.commit()
    return item


@router.post("/team-members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_team_member(payload: TeamMemberCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_team_member(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/teams/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_team_member_nested(team_id: str, payload: TeamMemberCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["team_id"] = team_id
    item = await TournamentEngineService.create_team_member(session, **data)
    await session.commit()
    return item


@router.post("/competition-participants", response_model=EngineParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_engine_participant(payload: EngineParticipantCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_participant(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/competitions/{competition_id}/participants", response_model=EngineParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_competition_participant(competition_id: str, payload: EngineParticipantCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["competition_id"] = competition_id
    item = await TournamentEngineService.create_participant(session, **data)
    await session.commit()
    return item


@router.post("/draws", response_model=DrawResponse, status_code=status.HTTP_201_CREATED)
async def create_draw(payload: DrawCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_draw(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/competitions/{competition_id}/draws", response_model=DrawResponse, status_code=status.HTTP_201_CREATED)
async def create_competition_draw(competition_id: str, payload: DrawCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["competition_id"] = competition_id
    item = await TournamentEngineService.create_draw(session, **data)
    await session.commit()
    return item


@router.post("/brackets", response_model=BracketResponse, status_code=status.HTTP_201_CREATED)
async def create_bracket(payload: BracketCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_bracket(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/competitions/{competition_id}/brackets", response_model=BracketResponse, status_code=status.HTTP_201_CREATED)
async def create_competition_bracket(competition_id: str, payload: BracketCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["competition_id"] = competition_id
    item = await TournamentEngineService.create_bracket(session, **data)
    await session.commit()
    return item


@router.post("/competition-matches", response_model=EngineMatchResponse, status_code=status.HTTP_201_CREATED)
async def create_engine_match(payload: EngineMatchCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_match(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/match-results", response_model=MatchResultResponse, status_code=status.HTTP_201_CREATED)
async def create_match_result(payload: MatchResultCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_result(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/matches/{match_id}/result", response_model=MatchResultResponse, status_code=status.HTTP_201_CREATED)
async def create_nested_match_result(match_id: str, payload: MatchResultCreateRequest, session: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["match_id"] = match_id
    item = await TournamentEngineService.create_result(session, **data)
    await session.commit()
    return item


@router.post("/participant-status-history", response_model=ParticipantStatusHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_participant_status_history(payload: ParticipantStatusHistoryCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_status_history(session, **payload.model_dump())
    await session.commit()
    return item


@router.post("/competition-events", response_model=CompetitionEventResponse, status_code=status.HTTP_201_CREATED)
async def create_competition_event(payload: CompetitionEventCreateRequest, session: AsyncSession = Depends(get_db)):
    item = await TournamentEngineService.create_event(session, **payload.model_dump())
    await session.commit()
    return item
