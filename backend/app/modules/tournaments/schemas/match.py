from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MatchStatus = Literal["SCHEDULED", "IN_PROGRESS", "FINISHED"]


class MatchCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category_id: str
    participant_red_id: str | None = None
    participant_blue_id: str | None = None
    status: MatchStatus = "SCHEDULED"


class MatchResponse(BaseModel):
    id: str
    tournament_id: str
    category_id: str
    participant_red_id: str | None = None
    participant_blue_id: str | None = None
    status: MatchStatus
    winner_id: str | None = None
