"""Read side of the tournament engine: entity lookups, name resolution, and
the competition/participant/team/match projections built from them.

Kept separate from :mod:`engine_service` so the write logic stays untouched:
everything here is query-only and safe to call from public pages. Names are
resolved in batch (one query per related table) rather than per row.

Three read concerns that used to live in this same 818-line file now have
their own modules instead, because each is a self-contained projection built
*on top of* what stays here rather than mixed in with it:

* :mod:`standings_service` — win/loss tallies for round-robin/group formats.
* :mod:`bracket_tree_service` — matches grouped into playoff rounds.
* :mod:`athlete_history_service` — one athlete's competitions, newest first
  (itself built on top of ``standings_service``).

:class:`TournamentReadService` keeps thin facade methods for all three
(``standings``, ``bracket_tree``, ``athlete_history``) so the many external
call sites (``routers/read.py`` foremost) needed no changes; the imports
inside those facades are function-local because the three modules above
import ``TournamentReadService`` from here, and an eager import back would
be a cycle.
"""

from __future__ import annotations

from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.athletes_access import Athlete, get_athletes_by_ids
from app.core.identity_access import User, get_users_by_ids
from app.modules.tournaments.domain import eligibility
from app.modules.tournaments.models import (
    Bracket,
    Competition,
    CompetitionEvent,
    Draw,
    Match,
    MatchLot,
    MatchResult,
    MatchRound,
    Participant,
    ParticipantStatusHistory,
    Team,
    Tournament,
)
from app.modules.tournaments.schemas.views import (
    BracketView,
    CompetitionEventView,
    CompetitionView,
    DrawView,
    MatchResultView,
    MatchView,
    ParticipantStatusHistoryView,
    ParticipantView,
    TeamMemberView,
    TeamView,
)
from app.modules.tournaments.services.read_common import athlete_display_name, full_name_of, parse_id

# Re-exported so the handful of existing call sites that import these two
# names from *this* module (rather than read_common, where they now live)
# keep working unchanged.
_athlete_display_name = athlete_display_name

__all__ = ["TournamentReadService", "parse_id", "_athlete_display_name"]


class TournamentReadService:
    # ------------------------------------------------------------------ #
    # entity lookups
    # ------------------------------------------------------------------ #

    @staticmethod
    async def get_competition(session: AsyncSession, competition_id: str) -> Competition:
        item = await session.get(Competition, parse_id(competition_id, "competition"))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competition not found")
        return item

    @staticmethod
    async def get_tournament(session: AsyncSession, tournament_id: str) -> Tournament:
        item = await session.get(Tournament, parse_id(tournament_id, "tournament"))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
        return item

    @staticmethod
    async def get_match(session: AsyncSession, match_id: str) -> Match:
        item = await session.get(Match, parse_id(match_id, "match"))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
        return item

    @staticmethod
    async def get_participant(session: AsyncSession, participant_id: str) -> Participant:
        item = await session.get(Participant, parse_id(participant_id, "participant"))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
        return item

    # ------------------------------------------------------------------ #
    # name resolution
    # ------------------------------------------------------------------ #

    @staticmethod
    async def build_participant_views(
        session: AsyncSession, participants: Iterable[Participant]
    ) -> dict[UUID, ParticipantView]:
        """Resolve athlete / team names for a batch of participants at once."""

        participants = list(participants)
        if not participants:
            return {}

        athlete_ids = {p.athlete_id for p in participants if p.athlete_id is not None}
        team_ids = {p.team_id for p in participants if p.team_id is not None}

        athletes: dict[UUID, Athlete] = {}
        users: dict[UUID, User] = {}
        if athlete_ids:
            athletes = await get_athletes_by_ids(session, athlete_ids)
            user_ids = {a.user_id for a in athletes.values() if a.user_id is not None}
            users = await get_users_by_ids(session, user_ids)

        teams: dict[UUID, Team] = {}
        if team_ids:
            team_rows = await session.scalars(select(Team).where(Team.id.in_(team_ids)))
            teams = {t.id: t for t in team_rows}

        views: dict[UUID, ParticipantView] = {}
        for participant in participants:
            team = teams.get(participant.team_id) if participant.team_id else None
            full_name = None
            if team is not None:
                display_name = team.name
                club_id = str(team.club_id) if team.club_id else None
            else:
                athlete = athletes.get(participant.athlete_id) if participant.athlete_id else None
                user = users.get(athlete.user_id) if athlete is not None else None
                display_name = athlete_display_name(athlete, user, participant.display_name)
                # Only worth a second line when the nickname (not the real
                # name) is what's actually shown as `display_name`.
                if athlete is not None and athlete.nickname:
                    full_name = full_name_of(user)
                club_id = None

            views[participant.id] = ParticipantView(
                id=str(participant.id),
                competition_id=str(participant.competition_id) if participant.competition_id else None,
                tournament_id=str(participant.tournament_id),
                type="TEAM" if participant.team_id is not None else "ATHLETE",
                display_name=display_name,
                full_name=full_name,
                athlete_id=str(participant.athlete_id) if participant.athlete_id else None,
                team_id=str(participant.team_id) if participant.team_id else None,
                club_id=club_id or (str(participant.club_id) if participant.club_id else None),
                club_name=participant.club_name,
                city=participant.city,
                seed=participant.seed,
                status=participant.status,
            )
        return views

    # ------------------------------------------------------------------ #
    # competitions
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_competitions(session: AsyncSession, tournament_id: str) -> list[CompetitionView]:
        tournament = await TournamentReadService.get_tournament(session, tournament_id)
        competitions = list(
            await session.scalars(
                select(Competition)
                .where(Competition.tournament_id == tournament.id)
                .order_by(Competition.created_at.asc())
            )
        )
        return [await TournamentReadService._competition_view(session, c) for c in competitions]

    @staticmethod
    async def competition_detail(session: AsyncSession, competition_id: str) -> CompetitionView:
        competition = await TournamentReadService.get_competition(session, competition_id)
        return await TournamentReadService._competition_view(session, competition)

    @staticmethod
    async def _competition_view(session: AsyncSession, competition: Competition) -> CompetitionView:
        participants = list(
            await session.scalars(select(Participant).where(Participant.competition_id == competition.id))
        )
        teams = list(await session.scalars(select(Team).where(Team.competition_id == competition.id)))
        matches = list(await session.scalars(select(Match).where(Match.competition_id == competition.id)))
        return CompetitionView(
            id=str(competition.id),
            tournament_id=str(competition.tournament_id),
            name=competition.name,
            description=competition.description,
            category_id=str(competition.category_id) if competition.category_id else None,
            min_age=competition.min_age,
            max_age=competition.max_age,
            age_label=eligibility.describe_bounds(competition.min_age, competition.max_age),
            max_age_gap=competition.max_age_gap,
            type=competition.competition_type,
            format=competition.format,
            status=competition.status,
            participant_count=len(participants),
            team_count=len(teams),
            match_count=len(matches),
            finished_match_count=sum(1 for m in matches if m.status == "FINISHED"),
        )

    # ------------------------------------------------------------------ #
    # participants / teams
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_participants(session: AsyncSession, competition_id: str) -> list[ParticipantView]:
        competition = await TournamentReadService.get_competition(session, competition_id)
        participants = list(
            await session.scalars(
                select(Participant)
                .where(Participant.competition_id == competition.id)
                .order_by(Participant.seed.asc().nulls_last(), Participant.created_at.asc())
            )
        )
        views = await TournamentReadService.build_participant_views(session, participants)
        return [views[p.id] for p in participants]

    @staticmethod
    async def list_teams(session: AsyncSession, competition_id: str) -> list[TeamView]:
        competition = await TournamentReadService.get_competition(session, competition_id)
        teams = list(
            await session.scalars(
                select(Team)
                .where(Team.competition_id == competition.id)
                .options(selectinload(Team.members))
                .order_by(Team.created_at.asc())
            )
        )
        if not teams:
            return []

        member_athlete_ids = {m.athlete_id for team in teams for m in team.members}
        athletes: dict[UUID, Athlete] = {}
        users: dict[UUID, User] = {}
        if member_athlete_ids:
            athletes = await get_athletes_by_ids(session, member_athlete_ids)
            user_ids = {a.user_id for a in athletes.values() if a.user_id is not None}
            users = await get_users_by_ids(session, user_ids)

        result: list[TeamView] = []
        for team in teams:
            members = sorted(team.members, key=lambda m: m.created_at)
            result.append(
                TeamView(
                    id=str(team.id),
                    competition_id=str(team.competition_id),
                    name=team.name,
                    short_name=team.short_name,
                    club_id=str(team.club_id) if team.club_id else None,
                    captain_id=str(team.captain_id) if team.captain_id else None,
                    members=[
                        TeamMemberView(
                            id=str(member.id),
                            athlete_id=str(member.athlete_id),
                            display_name=athlete_display_name(
                                athletes.get(member.athlete_id),
                                users.get(athletes[member.athlete_id].user_id)
                                if member.athlete_id in athletes
                                else None,
                            ),
                            role=member.role,
                        )
                        for member in members
                    ],
                )
            )
        return result

    # ------------------------------------------------------------------ #
    # matches
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _match_views(session: AsyncSession, matches: list[Match]) -> list[MatchView]:
        if not matches:
            return []

        participant_ids = {
            pid
            for match in matches
            for pid in (match.participant_red_id, match.participant_blue_id)
            if pid is not None
        }
        participants: list[Participant] = []
        if participant_ids:
            participants = list(
                await session.scalars(select(Participant).where(Participant.id.in_(participant_ids)))
            )
        participant_views = await TournamentReadService.build_participant_views(session, participants)

        match_ids = [m.id for m in matches]
        results = list(
            await session.scalars(select(MatchResult).where(MatchResult.match_id.in_(match_ids)))
        )
        results_by_match = {r.match_id: r for r in results}

        # Lots and соступ counts come along in two batch queries so a bracket
        # renders the drawn weapons and the running score without N+1 lookups.
        lots_by_match: dict[UUID, dict[str, MatchLot]] = {}
        lot_rows = await session.scalars(
            select(MatchLot).where(MatchLot.match_id.in_(match_ids), MatchLot.is_current.is_(True))
        )
        for lot in lot_rows:
            lots_by_match.setdefault(lot.match_id, {})[lot.side] = lot

        rounds_by_match: dict[UUID, list[MatchRound]] = {}
        round_rows = await session.scalars(
            select(MatchRound).where(MatchRound.match_id.in_(match_ids)).order_by(MatchRound.round_number.asc())
        )
        for round_row in round_rows:
            rounds_by_match.setdefault(round_row.match_id, []).append(round_row)

        views: list[MatchView] = []
        for match in matches:
            result = results_by_match.get(match.id)
            lots = lots_by_match.get(match.id, {})
            is_final = (match.stage_name or "").upper() == "FINAL"
            weapon_red = match.final_weapon if is_final else (lots["RED"].weapon if "RED" in lots else None)
            weapon_blue = match.final_weapon if is_final else (lots["BLUE"].weapon if "BLUE" in lots else None)
            completed_rounds = [
                r for r in rounds_by_match.get(match.id, []) if r.status == "COMPLETED"
            ]
            views.append(
                MatchView(
                    id=str(match.id),
                    tournament_id=str(match.tournament_id),
                    competition_id=str(match.competition_id) if match.competition_id else None,
                    draw_id=str(match.draw_id) if match.draw_id else None,
                    bracket_id=str(match.bracket_id) if match.bracket_id else None,
                    stage=match.stage_name,
                    status=match.status,
                    round_number=match.round_number,
                    position=match.position,
                    participant_a=participant_views.get(match.participant_red_id),
                    participant_b=participant_views.get(match.participant_blue_id),
                    winner_id=str(match.winner_id) if match.winner_id else None,
                    result=MatchResultView(
                        id=str(result.id),
                        match_id=str(result.match_id),
                        winner_id=str(result.winner_participant_id) if result.winner_participant_id else None,
                        method=result.result_type,
                        comment=result.notes,
                        recorded_at=result.recorded_at,
                    )
                    if result is not None
                    else None,
                    is_bye=match.is_bye,
                    next_match_id=str(match.next_match_id) if match.next_match_id else None,
                    next_slot=match.next_slot,
                    weapon_red=weapon_red,
                    weapon_blue=weapon_blue,
                    lot_required=not is_final and not match.is_bye and match.team_bout_id is None,
                    lot_completed=len(lots) == 2,
                    rounds_won_red=sum(
                        1 for r in completed_rounds if r.winner_participant_id == match.participant_red_id
                    ),
                    rounds_won_blue=sum(
                        1 for r in completed_rounds if r.winner_participant_id == match.participant_blue_id
                    ),
                    required_rounds_red=match.required_rounds_red,
                    required_rounds_blue=match.required_rounds_blue,
                )
            )
        return views

    # ------------------------------------------------------------------ #
    # bout building blocks (shared with the write services)
    # ------------------------------------------------------------------ #

    @staticmethod
    async def current_lots(session: AsyncSession, match_id: UUID) -> list[MatchLot]:
        """The lot standing for each side right now, superseded rows excluded."""
        return list(
            await session.scalars(
                select(MatchLot).where(MatchLot.match_id == match_id, MatchLot.is_current.is_(True))
            )
        )

    @staticmethod
    async def match_rounds(session: AsyncSession, match_id: UUID) -> list[MatchRound]:
        return list(
            await session.scalars(
                select(MatchRound).where(MatchRound.match_id == match_id).order_by(MatchRound.round_number.asc())
            )
        )

    @staticmethod
    async def list_competition_matches(session: AsyncSession, competition_id: str) -> list[MatchView]:
        competition = await TournamentReadService.get_competition(session, competition_id)
        matches = list(
            await session.scalars(
                select(Match)
                .where(Match.competition_id == competition.id)
                .order_by(Match.created_at.asc())
            )
        )
        return await TournamentReadService._match_views(session, matches)

    @staticmethod
    async def match_detail(session: AsyncSession, match_id: str) -> MatchView:
        match = await TournamentReadService.get_match(session, match_id)
        views = await TournamentReadService._match_views(session, [match])
        return views[0]

    @staticmethod
    async def match_result(session: AsyncSession, match_id: str) -> MatchResultView:
        match = await TournamentReadService.get_match(session, match_id)
        result = await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id))
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match has no result yet")
        return MatchResultView(
            id=str(result.id),
            match_id=str(result.match_id),
            winner_id=str(result.winner_participant_id) if result.winner_participant_id else None,
            method=result.result_type,
            comment=result.notes,
            recorded_at=result.recorded_at,
        )

    # ------------------------------------------------------------------ #
    # supporting lists
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_draws(session: AsyncSession, competition_id: str) -> list[DrawView]:
        competition = await TournamentReadService.get_competition(session, competition_id)
        draws = list(
            await session.scalars(
                select(Draw).where(Draw.competition_id == competition.id).order_by(Draw.created_at.asc())
            )
        )
        return [
            DrawView(
                id=str(d.id),
                competition_id=str(d.competition_id),
                name=d.name,
                type=d.draw_type,
                status=d.status,
                created_at=d.created_at,
            )
            for d in draws
        ]

    @staticmethod
    async def list_brackets(session: AsyncSession, competition_id: str) -> list[BracketView]:
        competition = await TournamentReadService.get_competition(session, competition_id)
        brackets = list(
            await session.scalars(
                select(Bracket)
                .where(Bracket.competition_id == competition.id)
                .order_by(Bracket.created_at.asc())
            )
        )
        return [
            BracketView(
                id=str(b.id),
                competition_id=str(b.competition_id),
                draw_id=str(b.draw_id) if b.draw_id else None,
                name=b.name,
                stage_type=b.stage_type,
                round=str(b.round) if b.round is not None else None,
                position=b.position,
            )
            for b in brackets
        ]

    @staticmethod
    async def list_events(session: AsyncSession, competition_id: str) -> list[CompetitionEventView]:
        competition = await TournamentReadService.get_competition(session, competition_id)
        events = list(
            await session.scalars(
                select(CompetitionEvent)
                .where(CompetitionEvent.competition_id == competition.id)
                .order_by(CompetitionEvent.created_at.desc())
            )
        )
        return [
            CompetitionEventView(
                id=str(e.id),
                competition_id=str(e.competition_id),
                event_type=e.event_type,
                description=e.description,
                payload=e.payload,
                created_at=e.created_at,
            )
            for e in events
        ]

    @staticmethod
    async def list_status_history(
        session: AsyncSession, participant_id: str
    ) -> list[ParticipantStatusHistoryView]:
        participant = await session.get(Participant, parse_id(participant_id, "participant"))
        if participant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
        history = list(
            await session.scalars(
                select(ParticipantStatusHistory)
                .where(ParticipantStatusHistory.participant_id == participant.id)
                .order_by(ParticipantStatusHistory.changed_at.asc())
            )
        )
        return [
            ParticipantStatusHistoryView(
                id=str(h.id),
                participant_id=str(h.participant_id),
                old_status=h.from_status,
                new_status=h.to_status,
                reason=h.reason,
                created_at=h.changed_at,
            )
            for h in history
        ]

    # ------------------------------------------------------------------ #
    # facade: standings / bracket tree / athlete history
    # ------------------------------------------------------------------ #
    #
    # These three do nothing but forward to the module that now owns the
    # logic (see the module docstring). Their imports are function-local
    # because standings_service/bracket_tree_service/athlete_history_service
    # all import TournamentReadService from here.

    @staticmethod
    async def standings(session: AsyncSession, competition_id: str):
        from app.modules.tournaments.services.standings_service import StandingsService

        return await StandingsService.standings(session, competition_id)

    @staticmethod
    async def bracket_tree(session: AsyncSession, competition_id: str):
        from app.modules.tournaments.services.bracket_tree_service import BracketTreeService

        return await BracketTreeService.bracket_tree(session, competition_id)

    @staticmethod
    async def athlete_history(session: AsyncSession, athlete_id: str):
        from app.modules.tournaments.services.athlete_history_service import AthleteHistoryService

        return await AthleteHistoryService.athlete_history(session, athlete_id)
