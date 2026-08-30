"""Authorization for the bout-running endpoints.

``docs/clubs-domain.md`` states the identity module must not be modified, so
this lives in the tournaments module and only *reads* identity: it wraps
identity's existing ``get_current_user`` and joins ``roles``/``user_roles``
read-only. No column, no service and no route in ``app/modules/identity`` is
touched.

Identity's ``Role`` model is a generic ``code``/``name`` pair with no fixed
enum, so it can express "this user is an instructor" as-is — a row with
``code="INSTRUCTOR"`` linked through ``user_roles``. No change to identity was
needed, and none was made.

Who may run a tournament:

* anyone holding one of :data:`MANAGER_ROLE_CODES`; or
* the tournament's own ``organizer_id``, which is already a first-class column
  on ``Tournament`` — so whoever created an event can always run it, with no
  role seeding required.

Scope note: this guard is applied to the **new** bout/bracket endpoints only.
The pre-existing tournament routes were left exactly as they were, per the
"preserve existing behavior" constraint; tightening them is a separate,
deliberate change because it breaks every unauthenticated client and test that
depends on them today.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.identity.models import Role, User, UserRole
from app.modules.identity.security.depends import get_current_user
from app.modules.tournaments.models import Competition, Match, Tournament

#: Role codes that may run any tournament. "INSTRUCTOR" is the code the client
#: asked for; "ADMIN" is included because an instance without it would have no
#: way to intervene in an event whose organizer account is unavailable.
MANAGER_ROLE_CODES: frozenset[str] = frozenset({"INSTRUCTOR", "ADMIN"})


@dataclass
class TournamentManager:
    """The authenticated caller plus the role codes they actually hold."""

    user: User
    role_codes: frozenset[str]

    @property
    def is_privileged(self) -> bool:
        return bool(self.role_codes & MANAGER_ROLE_CODES)

    def may_manage(self, tournament: Tournament) -> bool:
        return self.is_privileged or tournament.organizer_id == self.user.id


async def user_role_codes(session: AsyncSession, user_id: UUID) -> frozenset[str]:
    """Read-only lookup of a user's role codes. Never writes to identity."""
    codes = await session.scalars(
        select(Role.code).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user_id)
    )
    return frozenset(code.upper() for code in codes if code)


async def get_current_manager(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TournamentManager:
    return TournamentManager(user=current_user, role_codes=await user_role_codes(session, current_user.id))


def _forbid() -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the tournament organizer or an instructor may perform this action",
    )


async def ensure_can_manage_tournament(
    session: AsyncSession, manager: TournamentManager, tournament: Tournament
) -> None:
    if not manager.may_manage(tournament):
        _forbid()


async def ensure_can_manage_competition(
    session: AsyncSession, manager: TournamentManager, competition: Competition
) -> Tournament:
    tournament = await session.get(Tournament, competition.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    await ensure_can_manage_tournament(session, manager, tournament)
    return tournament


async def ensure_can_manage_match(
    session: AsyncSession, manager: TournamentManager, match: Match
) -> Tournament:
    tournament = await session.get(Tournament, match.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    await ensure_can_manage_tournament(session, manager, tournament)
    return tournament
