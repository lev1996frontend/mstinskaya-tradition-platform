from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.schemas import LoginRequest, LogoutRequest, MessageResponse, RefreshRequest, RegisterRequest, TokenResponse
from app.modules.auth.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    user, access_token, refresh_token = await AuthService.register(
        session,
        email=str(payload.email),
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    await AuthService.audit(session, user_id=user.id, action="REGISTER", entity_type="User", entity_id=str(user.id))
    await session.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    user, access_token, refresh_token = await AuthService.login(session, email=str(payload.email), password=payload.password)
    await AuthService.audit(session, user_id=user.id, action="LOGIN", entity_type="User", entity_id=str(user.id))
    await session.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    access_token, refresh_token = await AuthService.refresh(session, payload.refresh_token)
    await session.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(payload: LogoutRequest, session: AsyncSession = Depends(get_db)) -> MessageResponse:
    await AuthService.logout(session, payload.refresh_token)
    await session.commit()
    return MessageResponse(message="Logged out")
