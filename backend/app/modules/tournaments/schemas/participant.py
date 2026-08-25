from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ParticipantStatus = Literal["REGISTERED", "APPROVED", "DISQUALIFIED"]


class ParticipantCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category_id: str
    athlete_id: str
    status: ParticipantStatus = "REGISTERED"


class ParticipantResponse(BaseModel):
    id: str
    tournament_id: str
    category_id: str
    athlete_id: str
    status: ParticipantStatus
