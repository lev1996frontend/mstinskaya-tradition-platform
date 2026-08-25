from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EnrollmentStatus = Literal["STARTED", "COMPLETED"]


class EnrollmentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: str
    course_id: str


class EnrollmentResponse(BaseModel):
    id: str
    user_id: str
    course_id: str
    status: EnrollmentStatus
    progress_percent: int
