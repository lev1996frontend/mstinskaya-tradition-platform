from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.identity.models import User
from app.modules.identity.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserMeResponse
from app.modules.identity.security.depends import get_current_user
from app.modules.identity.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1", tags=["auth"])


@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(payload: RegisterRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    user, _, _ = await AuthService.register_user(
        session,
        email=payload.email,
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    await session.commit()

    access_token = AuthService.create_access_token(str(user.id))
    refresh_token = AuthService.create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/auth/login", response_model=TokenResponse)
async def login_user(payload: LoginRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await AuthService.authenticate_user(session, email=str(payload.email), password=payload.password)
    await session.commit()

    access_token = AuthService.create_access_token(str(user.id))
    refresh_token = AuthService.create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/users/me", response_model=UserMeResponse)
async def get_current_user(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user_data = await AuthService.get_user_me(session, str(current_user.id))
    return UserMeResponse(**user_data)
