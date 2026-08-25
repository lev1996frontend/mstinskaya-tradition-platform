from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import AuditLog, RefreshToken
from app.modules.auth.security import create_access_token, create_refresh_token, decode_token, hash_token
from app.modules.identity.models import Permission, Role, RolePermission, User, UserRole
from app.modules.identity.services.auth_service import AuthService as IdentityAuthService


class AuthService:
    @staticmethod
    async def register(session: AsyncSession, *, email: str, password: str, first_name: str, last_name: str) -> tuple[User, str, str]:
        user, _, _ = await IdentityAuthService.register_user(
            session, email=email, password=password, first_name=first_name, last_name=last_name
        )
        return await AuthService._issue_token_pair(session, user)

    @staticmethod
    async def login(session: AsyncSession, *, email: str, password: str) -> tuple[User, str, str]:
        user = await IdentityAuthService.authenticate_user(session, email=email, password=password)
        return await AuthService._issue_token_pair(session, user)

    @staticmethod
    async def _issue_token_pair(session: AsyncSession, user: User) -> tuple[User, str, str]:
        access_token = create_access_token(str(user.id))
        refresh_token, expires_at = create_refresh_token(str(user.id))
        session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_token),
                expires_at=expires_at,
                revoked=False,
                created_at=datetime.now(timezone.utc),
            )
        )
        await session.flush()
        return user, access_token, refresh_token

    @staticmethod
    async def refresh(session: AsyncSession, token: str) -> tuple[str, str]:
        payload = decode_token(token, expected_type="refresh")
        record = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
        if record is None or record.revoked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or not found")
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
        if str(record.user_id) != str(payload["sub"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token subject")

        record.revoked = True
        user = await session.get(User, record.user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        _, access_token, refresh_token = await AuthService._issue_token_pair(session, user)
        return access_token, refresh_token

    @staticmethod
    async def logout(session: AsyncSession, token: str) -> None:
        decode_token(token, expected_type="refresh")
        record = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Refresh token not found")
        record.revoked = True
        await session.flush()

    @staticmethod
    async def has_permission(session: AsyncSession, user_id: UUID, permission_code: str) -> bool:
        result = await session.scalar(
            select(Permission.id)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id, Permission.code == permission_code)
        )
        return result is not None

    @staticmethod
    async def audit(
        session: AsyncSession,
        *,
        user_id: UUID | None,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        old_value: dict | None = None,
        new_value: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            created_at=datetime.now(timezone.utc),
        )
        session.add(entry)
        await session.flush()
        return entry
