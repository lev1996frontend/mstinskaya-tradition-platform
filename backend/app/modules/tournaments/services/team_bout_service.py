"""«Трое на трое» — the second, team phase of a tournament.

SOURCE: teams of three meet round-robin, and a pairing is won by pinning the
opponent and signalling a finishing blow («обозначить добивание»).

That is a different decision than the individual поединок, so a team pairing is
*not* run through the lot and соступ machinery: there is no weapon draw and no
three-round point tally in the source for it. It reuses the same ``Match`` row,
``MatchResult`` append-then-correct semantics and competition journal, and it
records a single decisive result with the ``PIN_AND_FINISH`` method. The team
result is the aggregate of its three pairings — nothing more is invented.
"""

from __future__ import annotations

from itertools import combinations
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import (
    Competition,
    CompetitionEvent,
    Match,
    MatchResult,
    Participant,
    Team,
    TeamBout,
    TeamMember,
    TournamentCategory,
)
from app.modules.tournaments.services.bracket_service import parse_id

#: SOURCE — three fighters a side, so three pairings decide a team meeting.
TEAM_SIZE = 3

PAIRING_RESULT_METHOD = "PIN_AND_FINISH"


class TeamBoutService:
    @staticmethod
    async def _competition(session: AsyncSession, competition_id: str) -> Competition:
        item = await session.get(Competition, parse_id(competition_id, "competition"))
        if item is None:
            raise HTTPException(status_code=404, detail="Competition not found")
        if item.competition_type != "TEAM":
            raise HTTPException(status_code=400, detail="Team bouts belong to a TEAM competition")
        return item

    # ------------------------------------------------------------------ #
    # generation
    # ------------------------------------------------------------------ #

    @staticmethod
    async def generate_round_robin(
        session: AsyncSession, competition_id: str, *, actor_id: UUID | None = None
    ) -> list[TeamBout]:
        competition = await TeamBoutService._competition(session, competition_id)

        existing = await session.scalar(select(TeamBout.id).where(TeamBout.competition_id == competition.id))
        if existing is not None:
            raise HTTPException(status_code=409, detail="Team bouts already exist for this competition")

        teams = list(
            await session.scalars(
                select(Team).where(Team.competition_id == competition.id).order_by(Team.created_at.asc())
            )
        )
        if len(teams) < 2:
            raise HTTPException(status_code=400, detail="A round robin needs at least two teams")

        members_by_team: dict[UUID, list[TeamMember]] = {}
        for team in teams:
            rows = list(
                await session.scalars(
                    select(TeamMember)
                    .where(TeamMember.team_id == team.id)
                    .order_by(TeamMember.created_at.asc())
                )
            )
            fighters = [m for m in rows if (m.role or "FIGHTER").upper() != "RESERVE"]
            if len(fighters) < TEAM_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Team {team.name} has {len(fighters)} fighters; {TEAM_SIZE} are needed",
                )
            members_by_team[team.id] = fighters[:TEAM_SIZE]

        category = await session.scalar(
            select(TournamentCategory)
            .where(TournamentCategory.tournament_id == competition.tournament_id)
            .order_by(TournamentCategory.created_at.asc())
        )

        # Each fighter needs a participant row so a pairing is an ordinary match
        # between two participants, exactly like an individual bout.
        participant_by_athlete = await TeamBoutService._ensure_fighter_participants(
            session, competition, members_by_team
        )

        bouts: list[TeamBout] = []
        for index, (red, blue) in enumerate(combinations(teams, 2), start=1):
            bout = TeamBout(
                competition_id=competition.id,
                team_red_id=red.id,
                team_blue_id=blue.id,
                round_number=1,
                position=index,
                status="SCHEDULED",
            )
            session.add(bout)
            await session.flush()

            for slot in range(TEAM_SIZE):
                red_member = members_by_team[red.id][slot]
                blue_member = members_by_team[blue.id][slot]
                session.add(
                    Match(
                        tournament_id=competition.tournament_id,
                        category_id=category.id if category else None,
                        competition_id=competition.id,
                        team_bout_id=bout.id,
                        participant_red_id=participant_by_athlete[red_member.athlete_id],
                        participant_blue_id=participant_by_athlete[blue_member.athlete_id],
                        stage_name="TEAM_BOUT",
                        round_number=1,
                        position=slot + 1,
                        status="READY",
                    )
                )
            bouts.append(bout)

        session.add(
            CompetitionEvent(
                competition_id=competition.id,
                event_type="TEAM_BOUTS_GENERATED",
                description=f"Круговая система «трое на трое»: {len(bouts)} командных встреч",
                payload={
                    "team_count": len(teams),
                    "bout_count": len(bouts),
                    "actor_id": str(actor_id) if actor_id else None,
                },
            )
        )
        await session.flush()
        return bouts

    @staticmethod
    async def _ensure_fighter_participants(
        session: AsyncSession,
        competition: Competition,
        members_by_team: dict[UUID, list[TeamMember]],
    ) -> dict[UUID, UUID]:
        """Reuse an athlete's existing entry; never create a second one."""
        existing = list(
            await session.scalars(
                select(Participant).where(
                    Participant.competition_id == competition.id, Participant.athlete_id.isnot(None)
                )
            )
        )
        by_athlete: dict[UUID, UUID] = {p.athlete_id: p.id for p in existing if p.athlete_id}

        for team_id, members in members_by_team.items():
            for member in members:
                if member.athlete_id in by_athlete:
                    continue
                participant = Participant(
                    tournament_id=competition.tournament_id,
                    competition_id=competition.id,
                    athlete_id=member.athlete_id,
                    team_id=team_id,
                    status="APPROVED",
                )
                session.add(participant)
                await session.flush()
                by_athlete[member.athlete_id] = participant.id
        return by_athlete

    # ------------------------------------------------------------------ #
    # results
    # ------------------------------------------------------------------ #

    @staticmethod
    async def record_pairing_result(
        session: AsyncSession,
        match_id: str,
        *,
        winner_participant_id: str,
        notes: str | None = None,
        actor_id: UUID | None = None,
    ) -> Match:
        match = await session.get(Match, parse_id(match_id, "match"))
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        if match.team_bout_id is None:
            raise HTTPException(status_code=400, detail="This match is not a team pairing")
        if await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id)) is not None:
            raise HTTPException(status_code=409, detail="This pairing already has a result")

        winner_id = parse_id(winner_participant_id, "participant")
        if winner_id not in {match.participant_red_id, match.participant_blue_id}:
            raise HTTPException(status_code=400, detail="That participant is not in this pairing")

        session.add(
            MatchResult(
                match_id=match.id,
                winner_participant_id=winner_id,
                result_type=PAIRING_RESULT_METHOD,
                notes=notes,
            )
        )
        match.status = "FINISHED"
        match.winner_id = winner_id
        session.add(
            CompetitionEvent(
                competition_id=match.competition_id,
                event_type="TEAM_PAIRING_COMPLETED",
                description="Схватка в командной встрече завершена (удержание и обозначенное добивание)",
                payload={
                    "match_id": str(match.id),
                    "team_bout_id": str(match.team_bout_id),
                    "winner_id": str(winner_id),
                    "actor_id": str(actor_id) if actor_id else None,
                },
            )
        )
        await session.flush()
        await TeamBoutService.recompute(session, match.team_bout_id)
        await session.flush()
        return match

    @staticmethod
    async def recompute(session: AsyncSession, team_bout_id: UUID) -> TeamBout | None:
        """Re-derive the aggregate from the pairings. Never stored by hand."""
        bout = await session.get(TeamBout, team_bout_id)
        if bout is None:
            return None

        pairings = list(
            await session.scalars(
                select(Match).where(Match.team_bout_id == bout.id).order_by(Match.position.asc())
            )
        )
        participants = list(
            await session.scalars(
                select(Participant).where(
                    Participant.id.in_(
                        [p for m in pairings for p in (m.participant_red_id, m.participant_blue_id) if p]
                    )
                )
            )
        )
        team_of = {p.id: p.team_id for p in participants}

        wins_red = sum(1 for m in pairings if m.winner_id and team_of.get(m.winner_id) == bout.team_red_id)
        wins_blue = sum(1 for m in pairings if m.winner_id and team_of.get(m.winner_id) == bout.team_blue_id)
        bout.wins_red = wins_red
        bout.wins_blue = wins_blue

        decided = len([m for m in pairings if m.status == "FINISHED"])
        majority = TEAM_SIZE // 2 + 1
        if wins_red >= majority or wins_blue >= majority or decided == len(pairings):
            bout.status = "FINISHED"
            if wins_red > wins_blue:
                bout.winner_team_id = bout.team_red_id
            elif wins_blue > wins_red:
                bout.winner_team_id = bout.team_blue_id
            else:
                bout.winner_team_id = None
        elif decided > 0:
            bout.status = "IN_PROGRESS"
        await session.flush()
        return bout

    # ------------------------------------------------------------------ #
    # read
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_bouts(session: AsyncSession, competition_id: str) -> list[dict]:
        from app.modules.tournaments.services.read_service import TournamentReadService

        competition = await TeamBoutService._competition(session, competition_id)
        bouts = list(
            await session.scalars(
                select(TeamBout)
                .where(TeamBout.competition_id == competition.id)
                .order_by(TeamBout.round_number.asc().nulls_last(), TeamBout.position.asc().nulls_last())
            )
        )
        if not bouts:
            return []

        teams = {
            t.id: t
            for t in await session.scalars(select(Team).where(Team.competition_id == competition.id))
        }
        pairings = list(
            await session.scalars(
                select(Match)
                .where(Match.team_bout_id.in_([b.id for b in bouts]))
                .order_by(Match.position.asc())
            )
        )
        views = {v.id: v for v in await TournamentReadService._match_views(session, pairings)}

        result: list[dict] = []
        for bout in bouts:
            own = [m for m in pairings if m.team_bout_id == bout.id]
            result.append(
                {
                    "id": str(bout.id),
                    "competition_id": str(bout.competition_id),
                    "team_red_id": str(bout.team_red_id),
                    "team_blue_id": str(bout.team_blue_id),
                    "team_red_name": teams[bout.team_red_id].name if bout.team_red_id in teams else "",
                    "team_blue_name": teams[bout.team_blue_id].name if bout.team_blue_id in teams else "",
                    "status": bout.status,
                    "wins_red": bout.wins_red,
                    "wins_blue": bout.wins_blue,
                    "winner_team_id": str(bout.winner_team_id) if bout.winner_team_id else None,
                    "round_number": bout.round_number,
                    "position": bout.position,
                    "pairings": [views[str(m.id)] for m in own if str(m.id) in views],
                }
            )
        return result
