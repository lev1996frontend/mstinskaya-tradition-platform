"""Registration, login, refresh and logout.

Tokens travel to the browser two ways at once: in the JSON body (for
non-browser API callers — scripts, the test suite, a future mobile app —
that keep them in their own secure storage) and as httpOnly cookies (for the
browser, which now never puts a token anywhere its own JavaScript can read —
see the audit that prompted this: tokens used to live in `localStorage`,
readable by any XSS on the page). The frontend was rewired to rely on the
cookie alone and ignore the body's tokens.

`refresh` and `logout` prefer an explicit body's refresh token when one is
sent (a non-browser caller, or a test that needs to name a specific — say,
already-superseded — token) and otherwise fall back to the cookie; the
browser sends no body at all and relies on the cookie alone.

No ``from __future__ import annotations`` here, unlike the rest of the
codebase: ``@limiter.limit(...)`` wraps each endpoint in a function defined
inside ``slowapi``, and a *string* annotation (which is all stringified
postponed-evaluation annotations are) can only be resolved against the
wrapper's own globals, not this module's — FastAPI would fail at import time
trying to look up ``RegisterRequest`` there. Real, already-bound-to-the-class
annotations sidestep that lookup entirely.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.identity_access import User
from app.core.rate_limit import limiter
from app.core.session_auth import ACCESS_TOKEN_COOKIE
from app.core.session_auth import get_current_user as get_session_user
from app.modules.auth.schemas import LoginRequest, LogoutRequest, MessageResponse, RefreshRequest, RegisterRequest, TokenResponse
from app.modules.auth.security import ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES
from app.modules.auth.services.auth_service import AuthService
from app.modules.identity.schemas.auth import UserMeResponse
from app.modules.identity.services.auth_service import AuthService as IdentityAuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

#: `identity`'s own `/users/me` (`identity/routers/auth.py`) only reads the
#: `Authorization` header — it cannot be taught about the cookie without
#: modifying identity, which `docs/clubs-domain.md` forbids. So this route
#: shadows it the same way `auth`'s own `/register`/`/login` already shadow
#: identity's: same path, registered first in `app/main.py`, cookie-or-header
#: aware. It reads identity's own `get_user_me` — the same data, unmodified —
#: rather than duplicating that query.
me_router = APIRouter(prefix="/api/v1", tags=["auth"])


@me_router.get("/users/me", response_model=UserMeResponse)
async def get_me(
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user_data = await IdentityAuthService.get_user_me(session, str(current_user.id))
    return UserMeResponse(**user_data)

#: Scoped to the auth routes only — the one place that ever needs to read it
#: back — so a stolen access-cookie's XSS blast radius can never include this
#: one, and so it is never attached to the (much more numerous) plain API
#: calls that have no use for it.
REFRESH_TOKEN_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_auth_cookies(response: Response, *, access_token: str, refresh_token: str) -> None:
    secure = get_settings().resolved_cookie_secure
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        access_token,
        max_age=int(ACCESS_TOKEN_EXPIRES.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        REFRESH_TOKEN_COOKIE,
        refresh_token,
        max_age=int(REFRESH_TOKEN_EXPIRES.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path=REFRESH_COOKIE_PATH)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, payload: RegisterRequest, response: Response, session: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user, access_token, refresh_token = await AuthService.register(
        session,
        email=str(payload.email),
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    await AuthService.audit(session, user_id=user.id, action="REGISTER", entity_type="User", entity_id=str(user.id))
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, payload: LoginRequest, response: Response, session: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user, access_token, refresh_token = await AuthService.login(session, email=str(payload.email), password=payload.password)
    await AuthService.audit(session, user_id=user.id, action="LOGIN", entity_type="User", entity_id=str(user.id))
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    access_token, refresh_token = await AuthService.refresh(session, token)
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    payload: LogoutRequest | None = None,
    session: AsyncSession = Depends(get_db),
) -> MessageResponse:
    # Idempotent from the caller's point of view: whatever the cookie held —
    # nothing, an already-revoked token, one this backend never issued — the
    # end state is "no cookies, no session", so this always returns success
    # rather than surfacing an error the frontend would have nothing useful
    # to do with.
    token = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_TOKEN_COOKIE)
    if token:
        try:
            await AuthService.logout(session, token)
            await session.commit()
        except HTTPException:
            pass
    _clear_auth_cookies(response)
    return MessageResponse(message="Logged out")
