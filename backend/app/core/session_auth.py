"""The authenticated-caller dependency every protected route actually uses.

``docs/clubs-domain.md`` rule 5: "Identity module must not be modified." The
browser now authenticates with an httpOnly cookie instead of a token it can
read out of ``localStorage`` (see ``auth/router.py`` for where the cookie is
set), so the dependency that resolves "who is calling" has to learn to read
that cookie — but it cannot be added to identity's own equivalent (formerly
``app.modules.identity.security.depends.get_current_user``, header-only;
deleted once this module and the deletion of identity's own unreachable
routes left it with no callers) without modifying identity itself. This
module is the same kind of read-only wrapper ``app.core.identity_access``
already is for identity's data: it reads identity's own token-decoding
function (``identity.security.jwt.decode_token``) and user lookup, adds
nothing to identity, and every module that needs "who is calling" depends
on this instead.

The ``Authorization: Bearer`` header still works too, cookie-absent — tests
and any non-browser API caller keep working unchanged; only the browser
switched to the cookie.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity_access import User, get_user
from app.modules.identity.security.jwt import bearer_scheme, decode_token

#: Name of the httpOnly cookie the browser carries the access token in. Kept
#: here rather than in ``app.core.config`` since it is not something a
#: deployment ever needs to change, unlike the secret or the cookie's
#: ``Secure`` flag.
ACCESS_TOKEN_COOKIE = "access_token"


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    # An explicit Authorization header always wins over the ambient cookie:
    # a caller who bothered to name a credential meant that one, not whatever
    # session happens to still be sitting in the cookie jar (the browser
    # itself never sends this header post-migration, so this only matters for
    # non-browser callers — including every test that logs in as a second
    # user on the same client and passes that user's header explicitly).
    token = (credentials.credentials if credentials is not None else None) or request.cookies.get(
        ACCESS_TOKEN_COOKIE
    )
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_uuid = UUID(str(user_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload") from None

    user = await get_user(session, user_uuid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
