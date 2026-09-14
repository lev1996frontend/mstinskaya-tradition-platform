"""Read-only access to the identity module's data, for every other module.

``docs/clubs-domain.md`` rule 5: "Identity module must not be modified." That
means no domain can grow a proper service method on the identity side to ask
it what it needs (``UserService.get_by_id``, and so on) — so instead of each
module hand-rolling its own query against ``app.modules.identity.models``
(and several did, independently, for the same lookups), they call the
functions here. This is the same pattern ``tournaments/security/deps.py``
already used locally for role codes, generalized so every module shares one
implementation instead of each re-deriving it.

Nothing here writes to identity's tables. ``User``/``Role`` are re-exported so
a caller never has to import ``app.modules.identity.models`` itself just to
type-hint the value this module hands back.

One deliberate exception: ``auth``'s ``AuthService.verify_email`` takes the
``User`` handed back by ``get_user`` and sets ``email_verified_at`` on it
directly, added for email verification at registration — see
``docs/superpowers/specs/2026-09-14-email-verification-design.md``.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import Permission, Role, RolePermission, User, UserRole

__all__ = [
    "User",
    "Role",
    "get_user",
    "get_user_or_404",
    "get_users_by_ids",
    "get_role_codes",
    "has_permission",
]


async def get_user(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_user_or_404(
    session: AsyncSession, user_id: UUID, *, detail: str = "User not found"
) -> User:
    user = await get_user(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return user


async def get_users_by_ids(session: AsyncSession, user_ids: set[UUID] | list[UUID]) -> dict[UUID, User]:
    """Bulk lookup for name-resolution / display projections."""
    ids = set(user_ids)
    if not ids:
        return {}
    rows = await session.scalars(select(User).where(User.id.in_(ids)))
    return {row.id: row for row in rows}


async def get_role_codes(session: AsyncSession, user_id: UUID) -> frozenset[str]:
    codes = await session.scalars(
        select(Role.code).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user_id)
    )
    return frozenset(code.upper() for code in codes if code)


async def has_permission(session: AsyncSession, user_id: UUID, permission_code: str) -> bool:
    result = await session.scalar(
        select(Permission.id)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id, Permission.code == permission_code)
    )
    return result is not None
