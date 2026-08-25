from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

JudgingScenarioCategory = Literal["STRIKE", "WEAPON", "VIOLATION", "SAFETY"]


class JudgingScenarioCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    video_url: str | None = Field(default=None, max_length=500)
    correct_decision: str = Field(..., min_length=1, max_length=100)
    judge_comment: str | None = Field(default=None, max_length=4000)
    category: JudgingScenarioCategory = "STRIKE"


class JudgingScenarioResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    video_url: str | None = None
    correct_decision: str
    judge_comment: str | None = None
    category: JudgingScenarioCategory
