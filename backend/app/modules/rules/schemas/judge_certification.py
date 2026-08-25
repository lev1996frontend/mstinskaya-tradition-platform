from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

JudgeLevel = Literal["LOCAL", "REGIONAL", "MAIN"]
JudgeStatus = Literal["ACTIVE", "EXPIRED", "REVOKED"]


class JudgeCertificationCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: str
    level: JudgeLevel = "LOCAL"
    status: JudgeStatus = "ACTIVE"
    expires_at: datetime | None = None


class JudgeCertificationResponse(BaseModel):
    id: str
    user_id: str
    level: JudgeLevel
    status: JudgeStatus
    issued_at: datetime
    expires_at: datetime | None = None
