"""Matches grouped into playoff rounds, for rendering a bracket tree.

Split out of ``read_service.py``'s "bracket" section — a projection built on
top of :class:`TournamentReadService`'s match views, with its own small
ordering/labelling table that nothing else needs.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import Bracket, Match
from app.modules.tournaments.schemas.views import BracketRoundView, BracketTreeView, MatchView
from app.modules.tournaments.services.read_service import TournamentReadService

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


class BracketTreeService:
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
