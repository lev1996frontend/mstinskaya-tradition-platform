from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

#: One enum, extended rather than forked. ``READY``, ``BRACKET_CREATED`` and
#: ``FINAL`` are the new engine-driven states; ``RUNNING`` is the spec's
#: "in progress" and ``FINISHED`` its "completed", both kept under the names
#: the API and the frontend already used.
TournamentStatus = Literal[
    "DRAFT",
    "REGISTRATION",
    "READY",
    "BRACKET_CREATED",
    "RUNNING",
    "ACTIVE",
    "FINAL",
    "FINISHED",
    "ARCHIVED",
]


class TournamentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: TournamentStatus = "DRAFT"
    start_date: datetime | None = None
    end_date: datetime | None = None
    location: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    organizer_id: str
    ruleset_id: str


class TournamentResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    status: TournamentStatus
    start_date: datetime | None = None
    end_date: datetime | None = None
    location: str | None = None
    city: str | None = None
    country: str | None = None
    organizer_id: str
    ruleset_id: str
