from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CourseType = Literal["GENERAL", "ATHLETE", "INSTRUCTOR", "JUDGE"]
CourseLevel = Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]


class CourseCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    type: CourseType = "GENERAL"
    level: CourseLevel = "BEGINNER"
    thumbnail_url: str | None = Field(default=None, max_length=500)
    is_published: bool = False


class CourseResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    type: CourseType
    level: CourseLevel
    thumbnail_url: str | None = None
    is_published: bool
