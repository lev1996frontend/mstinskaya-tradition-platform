from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CompetitionType = Literal["INDIVIDUAL", "TEAM"]
CompetitionFormat = Literal["SINGLE_ELIMINATION", "ROUND_ROBIN", "GROUP_PLAYOFF"]
CompetitionStatus = Literal["DRAFT", "REGISTRATION", "RUNNING", "ACTIVE", "FINISHED", "CANCELLED"]
DrawType = Literal["RANDOM", "SEEDED", "MANUAL"]
ParticipantEngineStatus = Literal["REGISTERED", "CONFIRMED", "APPROVED", "WAITLISTED", "WITHDRAWN", "DISQUALIFIED", "ELIMINATED"]


class CompetitionCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    tournament_id: str
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    type: CompetitionType = "INDIVIDUAL"
    competition_type: CompetitionType | None = None
    format: CompetitionFormat = "SINGLE_ELIMINATION"
    status: CompetitionStatus = "DRAFT"

    @model_validator(mode="after")
    def normalize_type(self):
        if self.competition_type is not None:
            self.type = self.competition_type
        return self


class CompetitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tournament_id: str
    name: str
    description: str | None = None
    type: CompetitionType
    format: CompetitionFormat
    status: CompetitionStatus


class TeamCreateRequest(BaseModel):
    competition_id: str
    name: str = Field(..., min_length=2, max_length=150)
    short_name: str | None = Field(default=None, max_length=50)
    club_id: str | None = None
    captain_id: str | None = None


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    competition_id: str
    name: str
    short_name: str | None = None
    club_id: str | None = None
    captain_id: str | None = None


class TeamMemberCreateRequest(BaseModel):
    team_id: str
    athlete_id: str
    role: Literal["FIGHTER", "RESERVE", "CAPTAIN"] = "FIGHTER"


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    team_id: str
    athlete_id: str
    role: str


class EngineParticipantCreateRequest(BaseModel):
    competition_id: str
    athlete_id: str | None = None
    team_id: str | None = None
    type: Literal["ATHLETE", "TEAM"] | None = None
    seed: int | None = Field(default=None, ge=1)
    status: ParticipantEngineStatus = "REGISTERED"


class EngineParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tournament_id: str
    competition_id: str | None = None
    athlete_id: str | None = None
    team_id: str | None = None
    seed: int | None = None
    status: str


class DrawCreateRequest(BaseModel):
    competition_id: str
    name: str = Field(..., min_length=2, max_length=150)
    type: DrawType
    draw_type: DrawType | None = None
    status: Literal["DRAFT", "GENERATED", "LOCKED"] = "DRAFT"

    @model_validator(mode="after")
    def normalize_type(self):
        if self.draw_type is not None:
            self.type = self.draw_type
        return self


class DrawResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    competition_id: str
    name: str
    type: str
    status: str


class BracketCreateRequest(BaseModel):
    competition_id: str
    draw_id: str | None = None
    name: str = Field(..., min_length=2, max_length=150)
    round: int | str
    position: int = Field(ge=1)


class BracketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    competition_id: str
    draw_id: str | None = None
    name: str
    round: int | str
    position: int


class EngineMatchCreateRequest(BaseModel):
    competition_id: str
    draw_id: str | None = None
    bracket_id: str | None = None
    participant_a_id: str | None = None
    participant_b_id: str | None = None
    stage: Literal["QUALIFICATION", "GROUP", "QUARTERFINAL", "SEMIFINAL", "FINAL"] = "QUALIFICATION"
    status: Literal["SCHEDULED", "RUNNING", "IN_PROGRESS", "FINISHED", "CANCELLED"] = "SCHEDULED"


class EngineMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tournament_id: str
    competition_id: str | None = None
    draw_id: str | None = None
    bracket_id: str | None = None
    participant_a_id: str | None = None
    participant_b_id: str | None = None
    stage: str | None = None
    status: str


class MatchResultCreateRequest(BaseModel):
    match_id: str
    winner_id: str | None = None
    method: Literal["JUDGE_DECISION", "WITHDRAWAL", "DISQUALIFICATION", "NO_SHOW"]
    comment: str | None = Field(default=None, max_length=4000)


class MatchResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    match_id: str
    winner_id: str | None = None
    method: str
    comment: str | None = None
    recorded_at: datetime


class ParticipantStatusHistoryCreateRequest(BaseModel):
    participant_id: str
    new_status: str
    reason: str | None = Field(default=None, max_length=2000)


class ParticipantStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    participant_id: str
    old_status: str | None = None
    new_status: str
    reason: str | None = None
    created_at: datetime


class CompetitionEventCreateRequest(BaseModel):
    competition_id: str
    event_type: str = Field(..., min_length=2, max_length=50)
    description: str | None = Field(default=None, max_length=4000)
    payload: dict | None = None


class CompetitionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    competition_id: str
    event_type: str
    description: str | None = None
    payload: dict | None = None
    created_at: datetime
