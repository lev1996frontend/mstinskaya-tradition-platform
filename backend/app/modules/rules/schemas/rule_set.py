from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RuleSetStatus = Literal["DRAFT", "ACTIVE", "ARCHIVED"]


class RuleSetCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    version: str = Field(..., min_length=1, max_length=50)
    status: RuleSetStatus = "DRAFT"
    published_at: datetime | None = None


class RuleSetResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    version: str
    status: RuleSetStatus
    published_at: datetime | None = None
