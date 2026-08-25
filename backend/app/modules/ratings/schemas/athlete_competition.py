from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AthleteCompetitionBase(BaseModel):
    result: str = Field(default="PARTICIPANT", min_length=1, max_length=20)
    place: int | None = None
    matches_count: int = Field(default=0, ge=0)
    wins_count: int = Field(default=0, ge=0)
    losses_count: int = Field(default=0, ge=0)


class AthleteCompetitionCreate(AthleteCompetitionBase):
    athlete_id: UUID
    tournament_id: UUID
    category_id: UUID


class AthleteCompetitionRead(AthleteCompetitionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    athlete_id: UUID
    tournament_id: UUID
    category_id: UUID
    created_at: datetime
    updated_at: datetime
