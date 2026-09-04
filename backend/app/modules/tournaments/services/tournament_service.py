from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete
from app.modules.identity.models import User
from app.modules.rules.models import RuleSet
from app.modules.tournaments.models import (
    JudgeAssignment,
    Match,
    MatchDecision,
    Participant,
    Tournament,
    TournamentCategory,
    TournamentDocument,
)


class TournamentService:
    @staticmethod
    async def create_tournament(
        session: AsyncSession,
        *,
        title: str,
        description: str | None,
        status: str,
        start_date: datetime | None,
        end_date: datetime | None,
        location: str | None,
        city: str | None,
        country: str | None,
        organizer_id: str,
        ruleset_id: str,
    ) -> Tournament:
        try:
            parsed_organizer_id = UUID(str(organizer_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid organizer id") from None

        organizer = await session.get(User, parsed_organizer_id)
        if organizer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organizer not found")

        try:
            parsed_ruleset_id = UUID(str(ruleset_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ruleset id") from None

        ruleset = await session.get(RuleSet, parsed_ruleset_id)
        if ruleset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruleset not found")

        normalized_status = str(status).upper()
        valid_statuses = {"DRAFT", "REGISTRATION", "RUNNING", "ACTIVE", "FINISHED", "ARCHIVED"}
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tournament status")

        tournament = Tournament(
            title=title,
            description=description,
            status=normalized_status,
            start_date=start_date,
            end_date=end_date,
            location=location,
            city=city,
            country=country,
            organizer_id=parsed_organizer_id,
            ruleset_id=parsed_ruleset_id,
        )
        session.add(tournament)
        await session.flush()
        return tournament

    @staticmethod
    async def get_tournament(session: AsyncSession, tournament_id: str) -> Tournament:
        try:
            parsed_id = UUID(str(tournament_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tournament id") from None

        tournament = await session.get(Tournament, parsed_id)
        if tournament is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
        return tournament

    @staticmethod
    async def list_tournaments(session: AsyncSession) -> list[Tournament]:
        result = await session.execute(select(Tournament).order_by(Tournament.created_at.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def create_category(
        session: AsyncSession,
        *,
        tournament_id: str,
        name: str,
        description: str | None,
    ) -> TournamentCategory:
        tournament = await TournamentService.get_tournament(session, tournament_id)
        category = TournamentCategory(
            tournament_id=tournament.id,
            name=name,
            description=description,
        )
        session.add(category)
        await session.flush()
        return category

    @staticmethod
    async def list_categories(session: AsyncSession, tournament_id: str) -> list[TournamentCategory]:
        tournament = await TournamentService.get_tournament(session, tournament_id)
        result = await session.execute(
            select(TournamentCategory).where(TournamentCategory.tournament_id == tournament.id).order_by(TournamentCategory.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_participant(
        session: AsyncSession,
        *,
        tournament_id: str,
        category_id: str,
        athlete_id: str,
        status: str,
    ) -> Participant:
        tournament = await TournamentService.get_tournament(session, tournament_id)

        try:
            parsed_category_id = UUID(str(category_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category id") from None

        category = await session.get(TournamentCategory, parsed_category_id)
        if category is None or category.tournament_id != tournament.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        try:
            parsed_athlete_id = UUID(str(athlete_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid athlete id") from None

        athlete = await session.get(Athlete, parsed_athlete_id)
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")

        normalized_status = str(status).upper()
        valid_statuses = {"REGISTERED", "APPROVED", "DISQUALIFIED"}
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid participant status")

        participant = Participant(
            tournament_id=tournament.id,
            category_id=category.id,
            athlete_id=athlete.id,
            status=normalized_status,
        )
        session.add(participant)
        await session.flush()
        return participant

    @staticmethod
    async def list_participants(session: AsyncSession, tournament_id: str) -> list[Participant]:
        """The tournament's own entry list.

        Entries filed against the tournament and entrants of its competitions
        share one table (``Participant.competition_id`` tells them apart), so
        without the filter this returned both and every fighter appeared once
        per discipline they had been drawn into as well — a six-man competition
        inside a six-entry tournament read as twelve participants.

        Competition entrants have their own read path
        (``TournamentReadService.list_participants``), which carries the seed,
        club and city this projection has no columns for.
        """
        tournament = await TournamentService.get_tournament(session, tournament_id)
        result = await session.execute(
            select(Participant)
            .where(Participant.tournament_id == tournament.id, Participant.competition_id.is_(None))
            .order_by(Participant.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_match(
        session: AsyncSession,
        *,
        tournament_id: str,
        category_id: str,
        participant_red_id: str | None,
        participant_blue_id: str | None,
        status: str,
    ) -> Match:
        tournament = await TournamentService.get_tournament(session, tournament_id)

        try:
            parsed_category_id = UUID(str(category_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category id") from None

        category = await session.get(TournamentCategory, parsed_category_id)
        if category is None or category.tournament_id != tournament.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        participant_red = None
        participant_blue = None

        if participant_red_id is not None:
            try:
                parsed_red_id = UUID(str(participant_red_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid participant red id") from None
            participant_red = await session.get(Participant, parsed_red_id)
            if participant_red is None or participant_red.tournament_id != tournament.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant red not found")

        if participant_blue_id is not None:
            try:
                parsed_blue_id = UUID(str(participant_blue_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid participant blue id") from None
            participant_blue = await session.get(Participant, parsed_blue_id)
            if participant_blue is None or participant_blue.tournament_id != tournament.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant blue not found")

        normalized_status = str(status).upper()
        valid_statuses = {"SCHEDULED", "IN_PROGRESS", "FINISHED"}
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid match status")

        match = Match(
            tournament_id=tournament.id,
            category_id=category.id,
            participant_red_id=participant_red.id if participant_red else None,
            participant_blue_id=participant_blue.id if participant_blue else None,
            status=normalized_status,
        )
        session.add(match)
        await session.flush()
        return match

    @staticmethod
    async def get_match(session: AsyncSession, match_id: str) -> Match:
        try:
            parsed_id = UUID(str(match_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid match id") from None

        match = await session.get(Match, parsed_id)
        if match is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
        return match

    @staticmethod
    async def list_matches(session: AsyncSession, tournament_id: str) -> list[Match]:
        tournament = await TournamentService.get_tournament(session, tournament_id)
        result = await session.execute(
            select(Match).where(Match.tournament_id == tournament.id).order_by(Match.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_judge_assignment(
        session: AsyncSession,
        *,
        match_id: str,
        judge_id: str,
        role: str,
    ) -> JudgeAssignment:
        match = await TournamentService.get_match(session, match_id)

        try:
            parsed_judge_id = UUID(str(judge_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid judge id") from None

        judge = await session.get(User, parsed_judge_id)
        if judge is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Judge not found")

        normalized_role = str(role).upper()
        valid_roles = {"MAIN", "SIDE"}
        if normalized_role not in valid_roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid judge role")

        assignment = JudgeAssignment(
            match_id=match.id,
            judge_id=judge.id,
            role=normalized_role,
        )
        session.add(assignment)
        await session.flush()
        return assignment

    @staticmethod
    async def list_judge_assignments(session: AsyncSession, match_id: str) -> list[JudgeAssignment]:
        match = await TournamentService.get_match(session, match_id)
        result = await session.execute(
            select(JudgeAssignment).where(JudgeAssignment.match_id == match.id).order_by(JudgeAssignment.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_match_decision(
        session: AsyncSession,
        *,
        match_id: str,
        decision_type: str,
        winner_id: str | None,
        comment: str | None,
    ) -> MatchDecision:
        match = await TournamentService.get_match(session, match_id)

        normalized_decision_type = str(decision_type).upper()
        valid_decision_types = {"VICTORY", "DRAW", "DISQUALIFICATION"}
        if normalized_decision_type not in valid_decision_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid decision type")

        winner = None
        if winner_id is not None:
            try:
                parsed_winner_id = UUID(str(winner_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid winner id") from None
            winner = await session.get(Participant, parsed_winner_id)
            if winner is None or winner.tournament_id != match.tournament_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Winner participant not found")

        decision = MatchDecision(
            match_id=match.id,
            decision_type=normalized_decision_type,
            winner_id=winner.id if winner else None,
            comment=comment,
        )
        session.add(decision)
        await session.flush()
        return decision

    @staticmethod
    async def list_match_decisions(session: AsyncSession, match_id: str) -> list[MatchDecision]:
        match = await TournamentService.get_match(session, match_id)
        result = await session.execute(
            select(MatchDecision).where(MatchDecision.match_id == match.id).order_by(MatchDecision.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_document(
        session: AsyncSession,
        *,
        tournament_id: str,
        title: str,
        file_url: str,
        type: str,
    ) -> TournamentDocument:
        tournament = await TournamentService.get_tournament(session, tournament_id)

        normalized_type = str(type).upper()
        valid_types = {"RULES", "POSITION", "RESULTS"}
        if normalized_type not in valid_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document type")

        document = TournamentDocument(
            tournament_id=tournament.id,
            title=title,
            file_url=file_url,
            type=normalized_type,
        )
        session.add(document)
        await session.flush()
        return document

    @staticmethod
    async def list_documents(session: AsyncSession, tournament_id: str) -> list[TournamentDocument]:
        tournament = await TournamentService.get_tournament(session, tournament_id)
        result = await session.execute(
            select(TournamentDocument).where(TournamentDocument.tournament_id == tournament.id).order_by(TournamentDocument.created_at.asc())
        )
        return list(result.scalars().all())
