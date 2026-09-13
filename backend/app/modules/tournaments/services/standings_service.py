"""Win/loss standings for round-robin and group-playoff formats.

Split out of ``read_service.py``'s "standings" section — a projection built
entirely on top of :class:`TournamentReadService`'s entity lookups and name
resolution, with no state or logic of its own that any other read module
needs back.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import Match, MatchResult, Participant
from app.modules.tournaments.schemas.views import StandingsRow, StandingsView
from app.modules.tournaments.services.read_service import TournamentReadService


class StandingsService:
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
