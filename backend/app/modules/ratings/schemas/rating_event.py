from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RatingEventCreate(BaseModel):
    athlete_id: UUID
    tournament_id: UUID
    points: float = Field(default=0.0)
    reason: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, values):
        if isinstance(values, dict):
            if "source_id" in values and "tournament_id" not in values:
                values["tournament_id"] = values["source_id"]
        return values


class RatingEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    athlete_id: UUID
    source_type: str = Field(..., min_length=1, max_length=50)
    source_id: UUID
    delta: float = Field(default=0.0)
    points: float | None = None
    previous_rating: float
    new_rating: float
    reason: str | None = None
    created_at: datetime

    @model_validator(mode="after")
    def sync_points(self):
        if self.points is None:
            self.points = self.delta
        return self
