from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DecisionType = Literal["VICTORY", "DRAW", "DISQUALIFICATION"]


class MatchDecisionCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    decision_type: DecisionType
    winner_id: str | None = None
    comment: str | None = Field(default=None, max_length=4000)


class MatchDecisionResponse(BaseModel):
    id: str
    match_id: str
    decision_type: DecisionType
    winner_id: str | None = None
    comment: str | None = None
