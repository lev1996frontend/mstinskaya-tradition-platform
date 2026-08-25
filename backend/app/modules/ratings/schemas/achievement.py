from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AchievementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    award_type: str | None = Field(default=None, min_length=1, max_length=50)
    type: str | None = Field(default=None, min_length=1, max_length=50)
    issued_date: datetime | None = None

    @field_validator("type", mode="before")
    @classmethod
    def set_type_from_award_type(cls, value, info):
        if value is not None:
            return value
        data = info.data
        if isinstance(data, dict) and "award_type" in data and data["award_type"] is not None:
            return data["award_type"]
        return value


class AchievementCreate(AchievementBase):
    athlete_id: UUID


class AchievementRead(AchievementBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    athlete_id: UUID
    earned_at: datetime
    created_at: datetime
    updated_at: datetime
