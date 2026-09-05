from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def _as_id(value: object) -> object:
    """Accept the UUID that comes off an ORM attribute and hand back a string."""
    return str(value) if isinstance(value, UUID) else value


#: Identifier field: a string over the wire, tolerant of ORM UUIDs on the way out.
IdStr = Annotated[str, BeforeValidator(_as_id)]

CompetitionType = Literal["INDIVIDUAL", "TEAM"]
CompetitionFormat = Literal["SINGLE_ELIMINATION", "ROUND_ROBIN", "GROUP_PLAYOFF"]
CompetitionStatus = Literal["DRAFT", "REGISTRATION", "RUNNING", "ACTIVE", "FINISHED", "CANCELLED"]
DrawType = Literal["RANDOM", "SEEDED", "MANUAL"]
#: ``RESERVE`` is not a competitor: a reserve is named on the entry list, is
#: left out of the draw, and becomes ``REGISTERED`` only when an organizer puts
#: them in the place of someone who pulled out. Kept distinct from the statuses
#: that mean "out", because a reserve has not left — they have not yet entered.
ParticipantEngineStatus = Literal["REGISTERED", "CONFIRMED", "APPROVED", "WAITLISTED", "RESERVE", "WITHDRAWN", "DISQUALIFIED", "ELIMINATED"]

#: Bracket stages. The ROUND_OF_* names are produced by generated brackets
#: wider than eight fighters; TEAM_BOUT is one pairing of a «трое на трое».
MatchStage = Literal[
    "QUALIFICATION",
    "GROUP",
    "TEAM_BOUT",
    "ROUND_OF_128",
    "ROUND_OF_64",
    "ROUND_OF_32",
    "ROUND_OF_16",
    "QUARTERFINAL",
    "SEMIFINAL",
    "FINAL",
]

#: Bout lifecycle. READY_FOR_LOT/LOT_COMPLETED are the lot phase; READY is the
#: final's and a team pairing's equivalent, since neither draws a lot.
#: FINISHED is the persisted spelling of "completed".
MatchStatus = Literal[
    "SCHEDULED",
    "READY_FOR_LOT",
    "LOT_COMPLETED",
    "READY",
    "RUNNING",
    "IN_PROGRESS",
    "FINISHED",
    "CANCELLED",
]

#: How a поединок was decided. ROUND_WINS and DISARM come from the confirmed
#: соступ rules; PIN_AND_FINISH is the «трое на трое» decision.
ResultMethod = Literal[
    "JUDGE_DECISION",
    "ROUND_WINS",
    "DISARM",
    "PIN_AND_FINISH",
    "WITHDRAWAL",
    "DISQUALIFICATION",
    "NO_SHOW",
]


class CompetitionCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    tournament_id: IdStr
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    #: The tournament category this discipline is. «Абсолютная детская» and
    #: «Ветераны» are two disciplines of one tournament, each with its own field.
    category_id: IdStr | None = None
    #: Independently optional, and both usually absent. 45+ for «Ветераны», an
    #: upper bound for a children's category, neither for the open absolute —
    #: which is what lets a fifty-year-old enter both.
    min_age: int | None = Field(default=None, ge=0, le=120)
    max_age: int | None = Field(default=None, ge=0, le=120)
    #: Largest age difference allowed inside one bracket. Null — the usual case
    #: — means the discipline fights as one field. Set on a children's category
    #: it lets the platform cut the entrants into age streams.
    max_age_gap: int | None = Field(default=None, ge=0, le=120)
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
    id: IdStr
    tournament_id: IdStr
    name: str
    description: str | None = None
    category_id: IdStr | None = None
    min_age: int | None = None
    max_age: int | None = None
    max_age_gap: int | None = None
    type: CompetitionType
    format: CompetitionFormat
    status: CompetitionStatus


class TeamCreateRequest(BaseModel):
    competition_id: IdStr
    name: str = Field(..., min_length=2, max_length=150)
    short_name: str | None = Field(default=None, max_length=50)
    club_id: IdStr | None = None
    captain_id: IdStr | None = None


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    competition_id: IdStr
    name: str
    short_name: str | None = None
    club_id: IdStr | None = None
    captain_id: IdStr | None = None


class TeamMemberCreateRequest(BaseModel):
    team_id: IdStr
    athlete_id: IdStr
    role: Literal["FIGHTER", "RESERVE", "CAPTAIN"] = "FIGHTER"


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    team_id: IdStr
    athlete_id: IdStr
    role: str


class EngineParticipantCreateRequest(BaseModel):
    competition_id: IdStr
    athlete_id: IdStr | None = None
    team_id: IdStr | None = None
    type: Literal["ATHLETE", "TEAM"] | None = None
    seed: int | None = Field(default=None, ge=1)
    status: ParticipantEngineStatus = "REGISTERED"
    #: Only consulted where the discipline sets an age bound.
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    #: Lets an organizer admit someone the age bound excludes. Recorded in
    #: the journal, never silent; without it the entry is refused.
    age_override_reason: str | None = Field(default=None, min_length=3, max_length=2000)
    #: Registration city — one input to the first-round separation.
    city: str | None = Field(default=None, max_length=100)
    club_id: IdStr | None = None
    #: Club as written on the entry, and the higher-priority half of that
    #: separation. Free text: a spreadsheet names a club that may match no row.
    club_name: str | None = Field(default=None, max_length=150)
    #: Only for an entrant with no platform profile. When ``athlete_id`` is set
    #: the name is always resolved from that profile instead, so linking an
    #: existing athlete can never create a duplicate identity.
    display_name: str | None = Field(default=None, max_length=150)


class EngineParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    tournament_id: IdStr
    competition_id: IdStr | None = None
    athlete_id: IdStr | None = None
    team_id: IdStr | None = None
    seed: int | None = None
    status: str
    city: str | None = None
    club_id: IdStr | None = None
    club_name: str | None = None
    birth_year: int | None = None
    display_name: str | None = None


class DrawCreateRequest(BaseModel):
    competition_id: IdStr
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
    id: IdStr
    competition_id: IdStr
    name: str
    type: str
    status: str


class BracketCreateRequest(BaseModel):
    competition_id: IdStr
    draw_id: IdStr | None = None
    name: str = Field(..., min_length=2, max_length=150)
    round: int | str
    position: int = Field(ge=1)


class BracketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    competition_id: IdStr
    draw_id: IdStr | None = None
    name: str
    round: int | str
    position: int


class EngineMatchCreateRequest(BaseModel):
    competition_id: IdStr
    draw_id: IdStr | None = None
    bracket_id: IdStr | None = None
    participant_a_id: IdStr | None = None
    participant_b_id: IdStr | None = None
    stage: MatchStage = "QUALIFICATION"
    status: MatchStatus = "SCHEDULED"


class EngineMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    tournament_id: IdStr
    competition_id: IdStr | None = None
    draw_id: IdStr | None = None
    bracket_id: IdStr | None = None
    participant_a_id: IdStr | None = None
    participant_b_id: IdStr | None = None
    stage: str | None = None
    status: str


class MatchResultCreateRequest(BaseModel):
    match_id: IdStr
    winner_id: IdStr | None = None
    method: ResultMethod
    comment: str | None = Field(default=None, max_length=4000)


class MatchResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    match_id: IdStr
    winner_id: IdStr | None = None
    method: str
    comment: str | None = None
    recorded_at: datetime


class ParticipantStatusHistoryCreateRequest(BaseModel):
    participant_id: IdStr
    new_status: str
    reason: str | None = Field(default=None, max_length=2000)


class ParticipantStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    participant_id: IdStr
    old_status: str | None = None
    new_status: str
    reason: str | None = None
    created_at: datetime


class CompetitionEventCreateRequest(BaseModel):
    competition_id: IdStr
    event_type: str = Field(..., min_length=2, max_length=50)
    description: str | None = Field(default=None, max_length=4000)
    payload: dict | None = None


class CompetitionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: IdStr
    competition_id: IdStr
    event_type: str
    description: str | None = None
    payload: dict | None = None
    created_at: datetime
