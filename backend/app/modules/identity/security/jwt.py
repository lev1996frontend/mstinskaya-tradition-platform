from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

from app.core.config import get_settings

settings = get_settings()

bearer_scheme = HTTPBearer(auto_error=False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: str, *, expires_delta: timedelta | None = None) -> str:
    expire = _now() + (expires_delta or timedelta(minutes=30))
    payload = {"sub": subject, "type": "access", "exp": expire.timestamp()}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, *, expires_delta: timedelta | None = None) -> str:
    expire = _now() + (expires_delta or timedelta(days=7))
    payload = {"sub": subject, "type": "refresh", "exp": expire.timestamp()}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def get_token_payload(credentials: HTTPAuthorizationCredentials) -> dict[str, Any]:
    if credentials is None or credentials.credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    return decode_token(credentials.credentials)
