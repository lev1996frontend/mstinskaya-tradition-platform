"""Read side of the tournament engine.

Kept separate from :mod:`engine_service` so the write logic stays untouched:
everything here is query-only and safe to call from public pages. Names are
resolved in batch (one query per related table) rather than per row.
"""

from __future__ import annotations

from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete
from app.modules.identity.models import User
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
    TeamMember,
    Tournament,
)
from app.modules.tournaments.schemas.views import (
    AthleteParticipationView,
    BracketRoundView,
    BracketTreeView,
    BracketView,
    CompetitionEventView,
    CompetitionView,
    DrawView,
    MatchResultView,
    MatchView,
    ParticipantStatusHistoryView,
    ParticipantView,
    StandingsRow,
    StandingsView,
    TeamMemberView,
    TeamView,
)

#: Formats read from a round-robin-style standings table rather than a
#: playoff bracket — mirrors the tab logic in the competition workspace UI.
STANDINGS_FORMATS = {"ROUND_ROBIN", "GROUP_PLAYOFF"}

#: Position of a round inside the playoff column layout. Numeric rounds keep
#: their own number; named stages always come after them, in bout order. The
#: ROUND_OF_* entries are what a generated bracket wider than eight fighters
#: produces; without them those columns would sort *after* the final.
STAGE_ORDER = {
    "QUALIFICATION": -1,
    "GROUP": 0,
    "TEAM_BOUT": 500,
    "ROUND_OF_128": 980,
    "ROUND_OF_64": 985,
    "ROUND_OF_32": 990,
    "ROUND_OF_16": 995,
    "QUARTERFINAL": 1000,
    "SEMIFINAL": 1001,
    "FINAL": 1002,
}

STAGE_LABELS = {
    "QUALIFICATION": "Qualification",
    "GROUP": "Group stage",
    "TEAM_BOUT": "Team bout",
    "ROUND_OF_128": "Round of 128",
    "ROUND_OF_64": "Round of 64",
    "ROUND_OF_32": "Round of 32",
    "ROUND_OF_16": "Round of 16",
    "QUARTERFINAL": "Quarterfinal",
    "SEMIFINAL": "Semifinal",
    "FINAL": "Final",
}


def parse_id(value: str, label: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} id") from None


def _athlete_display_name(
    athlete: Athlete | None, user: User | None, fallback: str | None = None
) -> str:
    """Name for a competitor.

    A linked athlete profile always wins, so selecting an existing athlete in
    the wizard can never produce a second, divergent identity for that person.
    ``fallback`` is the tournament-local name of an entrant who has no platform
    profile at all — the only case where a name is stored on the entry itself.
    """
    if athlete is not None and athlete.nickname:
        return athlete.nickname
    if user is not None:
        full_name = " ".join(part for part in (user.first_name, user.last_name) if part).strip()
        if full_name:
            return full_name
        return user.email
    if fallback:
        return fallback
    return "Unknown participant"


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
            rows = await session.scalars(select(Athlete).where(Athlete.id.in_(athlete_ids)))
            athletes = {a.id: a for a in rows}
            user_ids = {a.user_id for a in athletes.values() if a.user_id is not None}
            if user_ids:
                user_rows = await session.scalars(select(User).where(User.id.in_(user_ids)))
                users = {u.id: u for u in user_rows}

        teams: dict[UUID, Team] = {}
        if team_ids:
            team_rows = await session.scalars(select(Team).where(Team.id.in_(team_ids)))
            teams = {t.id: t for t in team_rows}

        views: dict[UUID, ParticipantView] = {}
        for participant in participants:
            team = teams.get(participant.team_id) if participant.team_id else None
            if team is not None:
                display_name = team.name
                club_id = str(team.club_id) if team.club_id else None
            else:
                athlete = athletes.get(participant.athlete_id) if participant.athlete_id else None
                user = users.get(athlete.user_id) if athlete is not None else None
                display_name = _athlete_display_name(athlete, user, participant.display_name)
                club_id = None

            views[participant.id] = ParticipantView(
                id=str(participant.id),
                competition_id=str(participant.competition_id) if participant.competition_id else None,
                tournament_id=str(participant.tournament_id),
                type="TEAM" if participant.team_id is not None else "ATHLETE",
                display_name=display_name,
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
            rows = await session.scalars(select(Athlete).where(Athlete.id.in_(member_athlete_ids)))
            athletes = {a.id: a for a in rows}
            user_ids = {a.user_id for a in athletes.values() if a.user_id is not None}
            if user_ids:
                user_rows = await session.scalars(select(User).where(User.id.in_(user_ids)))
                users = {u.id: u for u in user_rows}

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
                            display_name=_athlete_display_name(
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

    # ------------------------------------------------------------------ #
    # standings
    # ------------------------------------------------------------------ #

    @staticmethod
    async def standings(session: AsyncSession, competition_id: str) -> StandingsView:
        competition = await TournamentReadService.get_competition(session, competition_id)
        participants = list(
            await session.scalars(
                select(Participant)
                .where(Participant.competition_id == competition.id)
                .order_by(Participant.seed.asc().nulls_last(), Participant.created_at.asc())
            )
        )
        participant_views = await TournamentReadService.build_participant_views(session, participants)

        matches = list(await session.scalars(select(Match).where(Match.competition_id == competition.id)))
        results_by_match: dict[UUID, MatchResult] = {}
        if matches:
            rows = await session.scalars(
                select(MatchResult).where(MatchResult.match_id.in_([m.id for m in matches]))
            )
            results_by_match = {r.match_id: r for r in rows}

        tally: dict[UUID, dict[str, int]] = {
            p.id: {"played": 0, "wins": 0, "losses": 0, "draws": 0, "no_results": 0} for p in participants
        }

        for match in matches:
            # A bye was never fought, so it counts as neither a win nor a
            # played bout — it only moves someone forward in the tree.
            if match.status == "CANCELLED" or match.is_bye:
                continue
            sides = [pid for pid in (match.participant_red_id, match.participant_blue_id) if pid in tally]
            result = results_by_match.get(match.id)
            if result is None:
                for pid in sides:
                    tally[pid]["no_results"] += 1
                continue
            winner_id = result.winner_participant_id
            for pid in sides:
                tally[pid]["played"] += 1
                if winner_id is None:
                    # A recorded result with no winner. Deliberately not
                    # interpreted further — victory conditions are unconfirmed.
                    tally[pid]["draws"] += 1
                elif pid == winner_id:
                    tally[pid]["wins"] += 1
                else:
                    tally[pid]["losses"] += 1

        ordered = sorted(
            participants,
            key=lambda p: (
                -tally[p.id]["wins"],
                tally[p.id]["losses"],
                participant_views[p.id].display_name.lower(),
            ),
        )

        rows: list[StandingsRow] = []
        previous_key: tuple[int, int, int] | None = None
        for index, participant in enumerate(ordered, start=1):
            counts = tally[participant.id]
            key = (counts["wins"], counts["losses"], counts["draws"])
            rows.append(
                StandingsRow(
                    position=index,
                    participant=participant_views[participant.id],
                    played=counts["played"],
                    wins=counts["wins"],
                    losses=counts["losses"],
                    draws=counts["draws"],
                    no_results=counts["no_results"],
                    tied_with_previous=previous_key == key,
                )
            )
            previous_key = key

        countable = [m for m in matches if m.status != "CANCELLED" and not m.is_bye]
        finished = sum(1 for m in countable if m.id in results_by_match)
        return StandingsView(
            competition_id=str(competition.id),
            format=competition.format,
            rows=rows,
            matches_total=len(countable),
            matches_finished=finished,
            provisional=finished < len(countable),
        )

    # ------------------------------------------------------------------ #
    # bracket
    # ------------------------------------------------------------------ #

    @staticmethod
    async def bracket_tree(session: AsyncSession, competition_id: str) -> BracketTreeView:
        competition = await TournamentReadService.get_competition(session, competition_id)
        brackets = list(await session.scalars(select(Bracket).where(Bracket.competition_id == competition.id)))
        brackets_by_id = {b.id: b for b in brackets}

        matches = list(
            await session.scalars(
                select(Match).where(Match.competition_id == competition.id).order_by(Match.created_at.asc())
            )
        )
        views = await TournamentReadService._match_views(session, matches)
        views_by_id = {v.id: v for v in views}

        buckets: dict[str, list[tuple[int, MatchView]]] = {}
        unassigned: list[MatchView] = []

        for match in matches:
            view = views_by_id[str(match.id)]
            bracket = brackets_by_id.get(match.bracket_id) if match.bracket_id else None
            key = None
            if bracket is not None and bracket.round:
                key = str(bracket.round).upper()
            elif match.stage_name:
                key = match.stage_name.upper()
            elif match.round_number is not None:
                key = str(match.round_number)

            if key is None:
                unassigned.append(view)
                continue

            slot = (bracket.position if bracket is not None and bracket.position is not None else match.position) or 0
            buckets.setdefault(key, []).append((slot, view))

        rounds: list[BracketRoundView] = []
        for key, entries in buckets.items():
            entries.sort(key=lambda pair: (pair[0], pair[1].id))
            rounds.append(
                BracketRoundView(
                    key=key,
                    label=STAGE_LABELS.get(key, f"Round {key}" if key.isdigit() else key.title()),
                    order=STAGE_ORDER.get(key, int(key) if key.isdigit() else 999),
                    matches=[view for _, view in entries],
                )
            )
        rounds.sort(key=lambda r: (r.order, r.key))

        return BracketTreeView(
            competition_id=str(competition.id),
            format=competition.format,
            rounds=rounds,
            unassigned=unassigned,
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
    # athlete history
    # ------------------------------------------------------------------ #

    @staticmethod
    async def athlete_history(session: AsyncSession, athlete_id: str) -> list[AthleteParticipationView]:
        """Every competition an athlete entered, newest first.

        Read-only projection over existing rows — nothing new is stored, and
        no placement is invented (see ``AthleteParticipationView``).
        """
        aid = parse_id(athlete_id, "athlete")
        participants = list(
            await session.scalars(
                select(Participant)
                .where(Participant.athlete_id == aid)
                .order_by(Participant.created_at.desc())
            )
        )
        if not participants:
            return []

        competition_ids = {p.competition_id for p in participants if p.competition_id is not None}
        competitions: dict[UUID, Competition] = {}
        if competition_ids:
            rows = await session.scalars(select(Competition).where(Competition.id.in_(competition_ids)))
            competitions = {c.id: c for c in rows}

        tournament_ids = {c.tournament_id for c in competitions.values()}
        tournaments: dict[UUID, Tournament] = {}
        if tournament_ids:
            rows = await session.scalars(select(Tournament).where(Tournament.id.in_(tournament_ids)))
            tournaments = {t.id: t for t in rows}

        results: list[AthleteParticipationView] = []
        for participant in participants:
            competition = competitions.get(participant.competition_id) if participant.competition_id else None
            if competition is None:
                continue
            tournament = tournaments.get(competition.tournament_id)

            view = AthleteParticipationView(
                participant_id=str(participant.id),
                tournament_id=str(competition.tournament_id),
                tournament_title=tournament.title if tournament else "—",
                competition_id=str(competition.id),
                competition_name=competition.name,
                format=competition.format,
                competition_status=competition.status,
                participant_status=participant.status,
                city=participant.city,
                seed=participant.seed,
            )

            if participant.status == "WITHDRAWN":
                view.outcome = "WITHDRAWN"
            elif participant.status == "DISQUALIFIED":
                view.outcome = "DISQUALIFIED"
            elif competition.format in STANDINGS_FORMATS:
                standings = await TournamentReadService.standings(session, str(competition.id))
                row = next((r for r in standings.rows if r.participant.id == str(participant.id)), None)
                if row is not None:
                    view.outcome = "STANDINGS"
                    view.standings_wins = row.wins
                    view.standings_losses = row.losses
                    view.standings_position = row.position
                    view.standings_tied = row.tied_with_previous
                    view.standings_provisional = standings.provisional
            else:
                matches = list(
                    await session.scalars(
                        select(Match)
                        .where(
                            Match.competition_id == competition.id,
                            or_(
                                Match.participant_red_id == participant.id,
                                Match.participant_blue_id == participant.id,
                            ),
                        )
                        .order_by(Match.round_number.asc().nulls_last(), Match.created_at.asc())
                    )
                )
                final = next((m for m in matches if (m.stage_name or "").upper() == "FINAL"), None)
                if final is not None and final.status == "FINISHED" and final.winner_id is not None:
                    view.outcome = "CHAMPION" if final.winner_id == participant.id else "FINALIST"
                else:
                    finished = [m for m in matches if m.status == "FINISHED" and not m.is_bye]
                    if finished:
                        last = finished[-1]
                        if last.winner_id == participant.id:
                            view.outcome = "IN_PROGRESS"
                        else:
                            view.outcome = "ELIMINATED"
                            view.eliminated_at_stage = last.stage_name

            results.append(view)
        return results

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
