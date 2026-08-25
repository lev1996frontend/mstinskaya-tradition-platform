from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RuleSectionCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    order_number: int = Field(default=1, ge=1)


class RuleSectionResponse(BaseModel):
    id: str
    rule_set_id: str
    title: str
    description: str | None = None
    order_number: int
