from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import Profile, Role, User, UserRole


class AuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except (ValueError, TypeError):
            return False

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    @staticmethod
    def create_access_token(subject: str, *, expires_delta: timedelta | None = None) -> str:
        from app.modules.identity.security.jwt import create_access_token

        return create_access_token(subject, expires_delta=expires_delta)

    @staticmethod
    def create_refresh_token(subject: str, *, expires_delta: timedelta | None = None) -> str:
        from app.modules.identity.security.jwt import create_refresh_token

        return create_refresh_token(subject, expires_delta=expires_delta)

    @staticmethod
    async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_default_role(session: AsyncSession) -> Role | None:
        result = await session.execute(select(Role).where(Role.code == "USER"))
        return result.scalar_one_or_none()

    @staticmethod
    async def register_user(
        session: AsyncSession,
        *,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
    ) -> tuple[User, Profile, list[str]]:
        existing = await AuthService.get_user_by_email(session, email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists",
            )

        user = User(
            email=email,
            password_hash=AuthService.hash_password(password),
            first_name=first_name,
            last_name=last_name,
            status="active",
        )
        session.add(user)
        await session.flush()

        profile = Profile(user_id=user.id, display_name=f"{first_name} {last_name}".strip())
        session.add(profile)

        default_role = await AuthService.get_default_role(session)
        if default_role is None:
            default_role = Role(code="USER", name="User")
            session.add(default_role)
            await session.flush()

        user_role = UserRole(user_id=user.id, role_id=default_role.id)
        session.add(user_role)
        await session.flush()

        await session.refresh(user)
        await session.refresh(profile)
        await session.refresh(default_role)

        role_codes = await session.scalars(
            select(Role.code)
            .join(UserRole, Role.id == UserRole.role_id)
            .where(UserRole.user_id == user.id)
        )
        return user, profile, list(role_codes)

    @staticmethod
    async def authenticate_user(session: AsyncSession, *, email: str, password: str) -> User:
        user = await AuthService.get_user_by_email(session, email)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not AuthService.verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return user

    @staticmethod
    async def get_user_me(session: AsyncSession, user_id: str) -> dict[str, Any]:
        try:
            user_uuid = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user id") from None

        user = await session.get(User, user_uuid)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        profile = await session.scalar(
            select(Profile).where(Profile.user_id == user.id)
        )

        role_names = list(
            await session.scalars(
                select(Role.code)
                .join(UserRole, Role.id == UserRole.role_id)
                .where(UserRole.user_id == user.id)
            )
        )
        return {
            "id": str(user.id),
            "email": user.email,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "roles": role_names,
            "profile": {
                "id": str(profile.id),
                "display_name": profile.display_name,
                "bio": profile.bio,
                "avatar_url": profile.avatar_url,
            } if profile else None,
        }
