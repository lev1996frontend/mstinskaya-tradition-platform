from __future__ import annotations

from pydantic import BaseModel


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: str
    roles: list[str]
    profile: dict | None
    email_verified: bool
