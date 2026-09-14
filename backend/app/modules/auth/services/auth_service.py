from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identity_access import User, get_user
from app.core.identity_access import has_permission as identity_has_permission
from app.modules.auth.models import AuditLog, EmailVerificationToken, RefreshToken
from app.modules.auth.security import create_access_token, create_refresh_token, decode_token, hash_token
from app.modules.identity.services.auth_service import AuthService as IdentityAuthService

EMAIL_VERIFICATION_TOKEN_EXPIRES = timedelta(hours=24)


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
        user = await get_user(session, record.user_id)
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
        return await identity_has_permission(session, user_id, permission_code)

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

    @staticmethod
    async def create_email_verification_token(session: AsyncSession, user_id: UUID) -> str:
        raw_token = secrets.token_urlsafe(32)
        session.add(
            EmailVerificationToken(
                user_id=user_id,
                token_hash=hash_token(raw_token),
                expires_at=datetime.now(timezone.utc) + EMAIL_VERIFICATION_TOKEN_EXPIRES,
                used_at=None,
                created_at=datetime.now(timezone.utc),
            )
        )
        await session.flush()
        return raw_token

    @staticmethod
    async def verify_email(session: AsyncSession, raw_token: str) -> User:
        record = await session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.token_hash == hash_token(raw_token))
        )
        if record is None or record.used_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Verification token expired")

        user = await get_user(session, record.user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        record.used_at = datetime.now(timezone.utc)
        user.email_verified_at = datetime.now(timezone.utc)
        await session.flush()
        return user

    @staticmethod
    async def resend_verification(session: AsyncSession, user: User) -> str | None:
        """`None` means already verified — the caller should treat this as a
        no-op and send no email, rather than issuing a token nobody needs."""
        if user.email_verified_at is not None:
            return None
        previous = await session.scalar(
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.used_at.is_(None),
            )
            .order_by(EmailVerificationToken.created_at.desc())
        )
        if previous is not None:
            previous.used_at = datetime.now(timezone.utc)
        return await AuthService.create_email_verification_token(session, user.id)
