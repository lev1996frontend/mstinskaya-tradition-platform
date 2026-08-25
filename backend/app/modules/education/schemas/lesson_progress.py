from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LessonProgressCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: str
    lesson_id: str
    completed: bool = False


class LessonProgressResponse(BaseModel):
    id: str
    user_id: str
    lesson_id: str
    completed: bool
