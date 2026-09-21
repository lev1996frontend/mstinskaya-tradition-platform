"""Read-only access to the athletes module's data, for every other module.

Mirrors ``app/core/identity_access.py``'s shape and reasoning: eight call
sites across ``tournaments`` and ``ratings`` were each importing
``app.modules.athletes.models.Athlete`` and hand-rolling the same
``session.get``/bulk-``select`` lookups directly against the model, in
violation of ``docs/architecture.md``'s "talk through the service layer, not
another domain's internals" guardrail. ``athletes`` had no read boundary of
its own the way ``identity`` does, so every change to ``Athlete`` risked
silently breaking tournaments/ratings call sites nobody could find by
grepping one place.

Unlike ``identity_access``, nothing here is a write, and nothing raises —
callers already have their own 404-or-not decisions (some treat a missing
athlete as fatal, some as "just skip it in this batch"), so this stays a
thin, opinion-free proxy over the same two query shapes every call site
actually needed. ``AthleteService.get_athlete`` (which does raise, and
eager-loads the linked user) is a different, higher-level tool for
``athletes``' own routes — this module is the read-only equivalent for
outside callers, the same relationship ``identity_access`` has to
``AuthService``.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete

__all__ = ["Athlete", "get_athlete", "get_athletes_by_ids"]


async def get_athlete(session: AsyncSession, athlete_id: UUID) -> Athlete | None:
    return await session.get(Athlete, athlete_id)


async def get_athletes_by_ids(session: AsyncSession, athlete_ids: set[UUID] | list[UUID]) -> dict[UUID, Athlete]:
    """Bulk lookup for name-resolution / display projections."""
    ids = set(athlete_ids)
    if not ids:
        return {}
    rows = await session.scalars(select(Athlete).where(Athlete.id.in_(ids)))
    return {row.id: row for row in rows}
