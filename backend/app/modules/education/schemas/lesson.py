from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LessonContentType = Literal["VIDEO", "TEXT", "DOCUMENT"]


class LessonCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    content_type: LessonContentType = "TEXT"
    video_url: str | None = Field(default=None, max_length=500)
    document_url: str | None = Field(default=None, max_length=500)
    duration_minutes: int | None = Field(default=None, ge=1)
    order_number: int = Field(default=1, ge=1)


class LessonResponse(BaseModel):
    id: str
    module_id: str
    title: str
    description: str | None = None
    content_type: LessonContentType
    video_url: str | None = None
    document_url: str | None = None
    duration_minutes: int | None = None
    order_number: int
