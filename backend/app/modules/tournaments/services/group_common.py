"""Constants and field-reading helpers shared by every group-stage module.

Split out of what used to be one 693-line ``group_service.py`` alongside
``group_standings_service.py`` and ``group_playoff_service.py`` — all three
need the same competition/group/match lookups, so those live here where
none of them creates a cycle importing the others.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import Competition, CompetitionGroup, Match
from app.modules.tournaments.services.bracket_common import parse_id

#: Formats that may hold a group stage. ``ROUND_ROBIN`` is one group — which is
#: precisely the five-fighter example in ``docs/tournament-engine.md``, где
#: круговая заканчивается полуфиналами.
GROUP_FORMATS: frozenset[str] = frozenset({"GROUP_PLAYOFF", "ROUND_ROBIN"})

STAGE_GROUP = "GROUP"


async def get_competition(session: AsyncSession, competition_id: str) -> Competition:
    item = await session.get(Competition, parse_id(competition_id, "competition"))
    if item is None:
        raise HTTPException(status_code=404, detail="Competition not found")
    return item


async def get_group(session: AsyncSession, group_id: str) -> CompetitionGroup:
    item = await session.get(CompetitionGroup, parse_id(group_id, "group"))
    if item is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return item


async def list_groups(session: AsyncSession, competition: Competition) -> list[CompetitionGroup]:
    return list(
        await session.scalars(
            select(CompetitionGroup)
            .where(CompetitionGroup.competition_id == competition.id)
            .order_by(CompetitionGroup.ordinal.asc())
        )
    )


async def list_group_matches(session: AsyncSession, competition: Competition) -> list[Match]:
    return list(
        await session.scalars(
            select(Match)
            .where(Match.competition_id == competition.id, Match.stage_name == STAGE_GROUP)
            .order_by(Match.position.asc().nulls_last())
        )
    )
