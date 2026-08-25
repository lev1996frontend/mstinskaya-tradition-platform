from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.tournaments.schemas.judge_assignment import JudgeAssignmentCreateRequest, JudgeAssignmentResponse
from app.modules.tournaments.schemas.match import MatchCreateRequest, MatchResponse
from app.modules.tournaments.schemas.match_decision import MatchDecisionCreateRequest, MatchDecisionResponse
from app.modules.tournaments.schemas.participant import ParticipantCreateRequest, ParticipantResponse
from app.modules.tournaments.schemas.tournament import TournamentCreateRequest, TournamentResponse
from app.modules.tournaments.schemas.tournament_category import TournamentCategoryCreateRequest, TournamentCategoryResponse
from app.modules.tournaments.schemas.tournament_document import TournamentDocumentCreateRequest, TournamentDocumentResponse
from app.modules.tournaments.services.tournament_service import TournamentService

router = APIRouter(prefix="/api/v1/tournaments", tags=["tournaments"])


@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(payload: TournamentCreateRequest, session: AsyncSession = Depends(get_db)) -> TournamentResponse:
    tournament = await TournamentService.create_tournament(
        session,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        location=payload.location,
        city=payload.city,
        country=payload.country,
        organizer_id=payload.organizer_id,
        ruleset_id=payload.ruleset_id,
    )
    await session.commit()
    return TournamentResponse(
        id=str(tournament.id),
        title=tournament.title,
        description=tournament.description,
        status=tournament.status,
        start_date=tournament.start_date,
        end_date=tournament.end_date,
        location=tournament.location,
        city=tournament.city,
        country=tournament.country,
        organizer_id=str(tournament.organizer_id),
        ruleset_id=str(tournament.ruleset_id),
    )


@router.get("", response_model=list[TournamentResponse])
async def list_tournaments(session: AsyncSession = Depends(get_db)) -> list[TournamentResponse]:
    tournaments = await TournamentService.list_tournaments(session)
    return [
        TournamentResponse(
            id=str(t.id),
            title=t.title,
            description=t.description,
            status=t.status,
            start_date=t.start_date,
            end_date=t.end_date,
            location=t.location,
            city=t.city,
            country=t.country,
            organizer_id=str(t.organizer_id),
            ruleset_id=str(t.ruleset_id),
        )
        for t in tournaments
    ]


@router.get("/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(tournament_id: str, session: AsyncSession = Depends(get_db)) -> TournamentResponse:
    tournament = await TournamentService.get_tournament(session, tournament_id)
    return TournamentResponse(
        id=str(tournament.id),
        title=tournament.title,
        description=tournament.description,
        status=tournament.status,
        start_date=tournament.start_date,
        end_date=tournament.end_date,
        location=tournament.location,
        city=tournament.city,
        country=tournament.country,
        organizer_id=str(tournament.organizer_id),
        ruleset_id=str(tournament.ruleset_id),
    )


@router.post("/{tournament_id}/categories", response_model=TournamentCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    tournament_id: str,
    payload: TournamentCategoryCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> TournamentCategoryResponse:
    category = await TournamentService.create_category(
        session,
        tournament_id=tournament_id,
        name=payload.name,
        description=payload.description,
    )
    await session.commit()
    return TournamentCategoryResponse(
        id=str(category.id),
        tournament_id=str(category.tournament_id),
        name=category.name,
        description=category.description,
    )


@router.get("/{tournament_id}/categories", response_model=list[TournamentCategoryResponse])
async def list_categories(tournament_id: str, session: AsyncSession = Depends(get_db)) -> list[TournamentCategoryResponse]:
    categories = await TournamentService.list_categories(session, tournament_id)
    return [
        TournamentCategoryResponse(
            id=str(category.id),
            tournament_id=str(category.tournament_id),
            name=category.name,
            description=category.description,
        )
        for category in categories
    ]


@router.post("/{tournament_id}/participants", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    tournament_id: str,
    payload: ParticipantCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> ParticipantResponse:
    participant = await TournamentService.create_participant(
        session,
        tournament_id=tournament_id,
        category_id=payload.category_id,
        athlete_id=payload.athlete_id,
        status=payload.status,
    )
    await session.commit()
    return ParticipantResponse(
        id=str(participant.id),
        tournament_id=str(participant.tournament_id),
        category_id=str(participant.category_id),
        athlete_id=str(participant.athlete_id),
        status=participant.status,
    )


@router.get("/{tournament_id}/participants", response_model=list[ParticipantResponse])
async def list_participants(tournament_id: str, session: AsyncSession = Depends(get_db)) -> list[ParticipantResponse]:
    participants = await TournamentService.list_participants(session, tournament_id)
    return [
        ParticipantResponse(
            id=str(p.id),
            tournament_id=str(p.tournament_id),
            category_id=str(p.category_id),
            athlete_id=str(p.athlete_id),
            status=p.status,
        )
        for p in participants
    ]


@router.post("/{tournament_id}/matches", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
async def create_match(
    tournament_id: str,
    payload: MatchCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> MatchResponse:
    match = await TournamentService.create_match(
        session,
        tournament_id=tournament_id,
        category_id=payload.category_id,
        participant_red_id=payload.participant_red_id,
        participant_blue_id=payload.participant_blue_id,
        status=payload.status,
    )
    await session.commit()
    return MatchResponse(
        id=str(match.id),
        tournament_id=str(match.tournament_id),
        category_id=str(match.category_id),
        participant_red_id=str(match.participant_red_id) if match.participant_red_id else None,
        participant_blue_id=str(match.participant_blue_id) if match.participant_blue_id else None,
        status=match.status,
        winner_id=str(match.winner_id) if match.winner_id else None,
    )


@router.get("/{tournament_id}/matches", response_model=list[MatchResponse])
async def list_matches(tournament_id: str, session: AsyncSession = Depends(get_db)) -> list[MatchResponse]:
    matches = await TournamentService.list_matches(session, tournament_id)
    return [
        MatchResponse(
            id=str(m.id),
            tournament_id=str(m.tournament_id),
            category_id=str(m.category_id),
            participant_red_id=str(m.participant_red_id) if m.participant_red_id else None,
            participant_blue_id=str(m.participant_blue_id) if m.participant_blue_id else None,
            status=m.status,
            winner_id=str(m.winner_id) if m.winner_id else None,
        )
        for m in matches
    ]


@router.post("/matches/{match_id}/judges", response_model=JudgeAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_judge_assignment(
    match_id: str,
    payload: JudgeAssignmentCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> JudgeAssignmentResponse:
    assignment = await TournamentService.create_judge_assignment(
        session,
        match_id=match_id,
        judge_id=payload.judge_id,
        role=payload.role,
    )
    await session.commit()
    return JudgeAssignmentResponse(
        id=str(assignment.id),
        match_id=str(assignment.match_id),
        judge_id=str(assignment.judge_id),
        role=assignment.role,
    )


@router.get("/matches/{match_id}/judges", response_model=list[JudgeAssignmentResponse])
async def list_judge_assignments(match_id: str, session: AsyncSession = Depends(get_db)) -> list[JudgeAssignmentResponse]:
    assignments = await TournamentService.list_judge_assignments(session, match_id)
    return [
        JudgeAssignmentResponse(
            id=str(a.id),
            match_id=str(a.match_id),
            judge_id=str(a.judge_id),
            role=a.role,
        )
        for a in assignments
    ]


@router.post("/matches/{match_id}/decisions", response_model=MatchDecisionResponse, status_code=status.HTTP_201_CREATED)
async def create_match_decision(
    match_id: str,
    payload: MatchDecisionCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> MatchDecisionResponse:
    decision = await TournamentService.create_match_decision(
        session,
        match_id=match_id,
        decision_type=payload.decision_type,
        winner_id=payload.winner_id,
        comment=payload.comment,
    )
    await session.commit()
    return MatchDecisionResponse(
        id=str(decision.id),
        match_id=str(decision.match_id),
        decision_type=decision.decision_type,
        winner_id=str(decision.winner_id) if decision.winner_id else None,
        comment=decision.comment,
    )


@router.get("/matches/{match_id}/decisions", response_model=list[MatchDecisionResponse])
async def list_match_decisions(match_id: str, session: AsyncSession = Depends(get_db)) -> list[MatchDecisionResponse]:
    decisions = await TournamentService.list_match_decisions(session, match_id)
    return [
        MatchDecisionResponse(
            id=str(d.id),
            match_id=str(d.match_id),
            decision_type=d.decision_type,
            winner_id=str(d.winner_id) if d.winner_id else None,
            comment=d.comment,
        )
        for d in decisions
    ]


@router.post("/{tournament_id}/documents", response_model=TournamentDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    tournament_id: str,
    payload: TournamentDocumentCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> TournamentDocumentResponse:
    document = await TournamentService.create_document(
        session,
        tournament_id=tournament_id,
        title=payload.title,
        file_url=payload.file_url,
        type=payload.type,
    )
    await session.commit()
    return TournamentDocumentResponse(
        id=str(document.id),
        tournament_id=str(document.tournament_id),
        title=document.title,
        file_url=document.file_url,
        type=document.type,
    )


@router.get("/{tournament_id}/documents", response_model=list[TournamentDocumentResponse])
async def list_documents(tournament_id: str, session: AsyncSession = Depends(get_db)) -> list[TournamentDocumentResponse]:
    documents = await TournamentService.list_documents(session, tournament_id)
    return [
        TournamentDocumentResponse(
            id=str(d.id),
            tournament_id=str(d.tournament_id),
            title=d.title,
            file_url=d.file_url,
            type=d.type,
        )
        for d in documents
    ]
