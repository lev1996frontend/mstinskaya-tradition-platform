from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

JudgeRole = Literal["MAIN", "SIDE"]


class JudgeAssignmentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    judge_id: str
    role: JudgeRole = "SIDE"


class JudgeAssignmentResponse(BaseModel):
    id: str
    match_id: str
    judge_id: str
    role: JudgeRole
