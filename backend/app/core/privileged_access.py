"""Shared "is this caller privileged" check, independent of any one domain.

Extracted out of ``tournaments/security/deps.py`` to break a circular
dependency: ``rules`` needed the INSTRUCTOR/ADMIN check tournaments already
had (see the removed comment in ``rules/routers/rules.py`` explaining why it
imported ``tournaments.security.deps.get_current_manager`` rather than
duplicate it), while ``tournaments`` models import ``rules.models.RuleSet``
(a tournament is created against a ruleset). Both sides depending on each
other is the cycle; this module depends on neither, so both now depend on it
instead.

``tournaments.security.deps.TournamentManager`` still exists — it adds
``may_manage(tournament)``, which needs a ``Tournament`` and so is genuinely
tournament-specific — but it now builds on :data:`PRIVILEGED_ROLE_CODES` and
:class:`PrivilegedCaller` from here instead of defining its own copy of the
role set.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity_access import User, get_role_codes
from app.core.session_auth import get_current_user

#: Role codes that may perform privileged/administrative actions across
#: domains. "INSTRUCTOR" is the code the client asked for; "ADMIN" is
#: included because an instance without it would have no way to intervene
#: when the usual privileged account is unavailable.
PRIVILEGED_ROLE_CODES: frozenset[str] = frozenset({"INSTRUCTOR", "ADMIN"})


@dataclass
class PrivilegedCaller:
    """The authenticated caller plus the role codes they actually hold."""

    user: User
    role_codes: frozenset[str]

    @property
    def is_privileged(self) -> bool:
        return bool(self.role_codes & PRIVILEGED_ROLE_CODES)


async def get_current_privileged_caller(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PrivilegedCaller:
    return PrivilegedCaller(user=current_user, role_codes=await get_role_codes(session, current_user.id))


def require_privileged(caller: PrivilegedCaller, *, detail: str) -> None:
    if not caller.is_privileged:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
