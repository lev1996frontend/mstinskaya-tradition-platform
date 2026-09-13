"""Tiny helpers shared by every tournament read-projection module.

Split out of what used to be one 818-line ``read_service.py`` alongside
``standings_service.py``, ``bracket_tree_service.py`` and
``athlete_history_service.py`` — those three depend on
:class:`app.modules.tournaments.services.read_service.TournamentReadService`
for entity lookups and name resolution, so the two truly cross-cutting
pieces (``parse_id``, name resolution) live here instead, where every module
can import them without creating a cycle back into ``read_service``.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.core.identity_access import User
from app.modules.athletes.models import Athlete


def parse_id(value: str, label: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} id") from None


def athlete_display_name(
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
