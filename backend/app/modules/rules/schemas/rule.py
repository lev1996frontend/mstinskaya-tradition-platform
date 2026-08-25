from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RuleType = Literal["GENERAL", "SAFETY", "COMBAT", "JUDGING", "VIOLATION"]


class RuleCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=1, max_length=20000)
    rule_type: RuleType = "GENERAL"
    order_number: int = Field(default=1, ge=1)


class RuleResponse(BaseModel):
    id: str
    section_id: str
    title: str
    content: str
    rule_type: RuleType
    order_number: int
