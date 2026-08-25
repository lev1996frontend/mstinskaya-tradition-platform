from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AthleteLevel = Literal["BEGINNER", "PRACTITIONER", "INSTRUCTOR", "MASTER"]


class AthleteCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: str
    nickname: str | None = Field(default=None, max_length=100)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    experience_years: int = Field(default=0, ge=0)
    level: AthleteLevel = "BEGINNER"
    bio: str | None = Field(default=None, max_length=2000)
    photo_url: str | None = Field(default=None, max_length=500)


class AthleteUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nickname: str | None = Field(default=None, max_length=100)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    experience_years: int | None = Field(default=None, ge=0)
    level: AthleteLevel | None = None
    bio: str | None = Field(default=None, max_length=2000)
    photo_url: str | None = Field(default=None, max_length=500)


class AthleteResponse(BaseModel):
    id: str
    user_id: str
    nickname: str | None = None
    birth_year: int | None = None
    experience_years: int = 0
    level: AthleteLevel
    bio: str | None = None
    photo_url: str | None = None
