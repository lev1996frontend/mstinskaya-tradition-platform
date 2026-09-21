"""Registration, login, refresh and logout.

Tokens never appear in a JSON body at all now, in either direction — only as
httpOnly cookies. They used to: the response body carried the token pair
alongside the Set-Cookie headers (for "non-browser callers"), and refresh/
logout accepted one explicitly in the request body as a fallback. Neither
was actually load-bearing for anything but the test suite, and a token
appearing in a body a browser's `fetch()` can read is exactly the exposure
this whole change exists to close — a response body is JS-readable the
instant it arrives, XSS or not, so "the browser just doesn't store it" was
never the full fix. The test suite now drives the same rotation/reuse/
logout behavior through `TestClient`'s cookie jar (see `tests/
test_auth_foundation.py` and `tests/auth_test_helpers.py`).

No ``from __future__ import annotations`` here, unlike the rest of the
codebase: ``@limiter.limit(...)`` wraps each endpoint in a function defined
inside ``slowapi``, and a *string* annotation (which is all stringified
postponed-evaluation annotations are) can only be resolved against the
wrapper's own globals, not this module's — FastAPI would fail at import time
trying to look up ``RegisterRequest`` there. Real, already-bound-to-the-class
annotations sidestep that lookup entirely.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.database import get_db
from app.core.email import EmailService
from app.core.identity_access import User
from app.core.rate_limit import limiter
from app.core.session_auth import ACCESS_TOKEN_COOKIE
from app.core.session_auth import get_current_user as get_session_user
from app.modules.auth.schemas import LoginRequest, MessageResponse, RegisterRequest, VerifyEmailRequest
from app.modules.auth.security import ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES
from app.modules.auth.services.auth_service import AuthService
from app.modules.identity.schemas.auth import UserMeResponse
from app.modules.identity.services.auth_service import AuthService as IdentityAuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)

#: `identity` used to have its own `/users/me` (`identity/routers/auth.py`,
#: since deleted) reading only the `Authorization` header; it could not be
#: taught about the cookie without modifying identity, which
#: `docs/clubs-domain.md` forbids, so this route shadowed it — same path,
#: registered first in `app/main.py`. With the whole shadowed router gone
#: (its own register/login were unreachable too, and this was its one
#: still-reachable route), this is now simply where `/users/me` lives. It
#: reads identity's own `get_user_me` — the same data, unmodified — rather
#: than duplicating that query.
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


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, payload: RegisterRequest, response: Response, session: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user, access_token, refresh_token = await AuthService.register(
        session,
        email=str(payload.email),
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        privacy_consent=payload.privacy_consent,
    )
    await AuthService.audit(session, user_id=user.id, action="REGISTER", entity_type="User", entity_id=str(user.id))
    raw_token = await AuthService.create_email_verification_token(session, user.id)
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)

    # Never fails registration: the row committed above is real regardless of
    # whether this send succeeds, and the user can always trigger
    # /resend-verification later.
    verify_url = f"{get_settings().frontend_base_url}/verify-email?token={raw_token}"
    try:
        await run_in_threadpool(EmailService.send_verification_email, to=str(payload.email), verify_url=verify_url)
    except Exception:
        logger.exception("Failed to send verification email for user_id=%s", user.id)

    return MessageResponse(message="Registered")


@router.post("/login", response_model=MessageResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, payload: LoginRequest, response: Response, session: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user, access_token, refresh_token = await AuthService.login(session, email=str(payload.email), password=payload.password)
    await AuthService.audit(session, user_id=user.id, action="LOGIN", entity_type="User", entity_id=str(user.id))
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return MessageResponse(message="Logged in")


@router.post("/refresh", response_model=MessageResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, response: Response, session: AsyncSession = Depends(get_db)) -> MessageResponse:
    token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    access_token, refresh_token = await AuthService.refresh(session, token)
    await session.commit()
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return MessageResponse(message="Refreshed")


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response, session: AsyncSession = Depends(get_db)) -> MessageResponse:
    # Idempotent from the caller's point of view: whatever the cookie held —
    # nothing, an already-revoked token, one this backend never issued — the
    # end state is "no cookies, no session", so this always returns success
    # rather than surfacing an error the frontend would have nothing useful
    # to do with.
    token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if token:
        try:
            await AuthService.logout(session, token)
            await session.commit()
        except HTTPException:
            pass
    _clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


@router.post("/verify-email", response_model=MessageResponse)
@limiter.limit("20/minute")
async def verify_email(
    request: Request, payload: VerifyEmailRequest, session: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await AuthService.verify_email(session, payload.token)
    await session.commit()
    return MessageResponse(message="Email verified")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> MessageResponse:
    raw_token = await AuthService.resend_verification(session, current_user)
    await session.commit()
    if raw_token is None:
        return MessageResponse(message="Email already verified")

    verify_url = f"{get_settings().frontend_base_url}/verify-email?token={raw_token}"
    try:
        await run_in_threadpool(EmailService.send_verification_email, to=current_user.email, verify_url=verify_url)
    except Exception:
        logger.exception("Failed to send verification email for user_id=%s", current_user.id)
    return MessageResponse(message="Verification email sent")
