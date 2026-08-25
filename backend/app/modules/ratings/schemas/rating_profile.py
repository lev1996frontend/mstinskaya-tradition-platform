from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RatingProfileBase(BaseModel):
    rating: float = Field(default=0.0, ge=0)
    rating_points: float | None = Field(default=None, ge=0)
    rank_position: int | None = Field(default=None, ge=1)
    wins: int = Field(default=0, ge=0)
    losses: int = Field(default=0, ge=0)
    draws: int = Field(default=0, ge=0)
    tier: str = Field(default="unranked", min_length=1, max_length=50)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, values):
        if isinstance(values, dict):
            if "rating_points" in values and "rating" not in values:
                values["rating"] = values["rating_points"]
            elif "rating" in values and "rating_points" not in values:
                values["rating_points"] = values["rating"]
        return values


class RatingProfileCreate(RatingProfileBase):
    athlete_id: UUID


class RatingProfileRead(RatingProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    athlete_id: UUID
    last_calculated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
