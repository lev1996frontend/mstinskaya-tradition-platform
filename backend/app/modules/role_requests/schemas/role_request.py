from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

#: Mirrors ROLE_CODES in app/modules/role_requests/models/role_request.py —
#: MODERATOR is excluded from self-service requests (see that module's
#: docstring); kept in sync by hand, same as the frontend mirror.
RoleCode = Literal["INSTRUCTOR", "ORGANIZER", "JUDGE"]
RejectionReasonCode = Literal["INSUFFICIENT_EVIDENCE", "NOT_RECOGNIZED", "DUPLICATE_REQUEST", "OTHER"]


class RoleRequestCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    role_code: RoleCode
    justification: str = Field(..., min_length=1, max_length=2000)


class RoleRequestReviewRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    status: Literal["APPROVED", "REJECTED"]
    reason_code: RejectionReasonCode | None = None
    reason_text: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _validate_rejection_reason(self) -> "RoleRequestReviewRequest":
        if self.status == "REJECTED":
            if self.reason_code is None:
                raise ValueError("reason_code is required when rejecting a role request")
            if self.reason_code == "OTHER" and not self.reason_text:
                raise ValueError("reason_text is required when reason_code is OTHER")
        return self


class RoleRequestResponse(BaseModel):
    id: str
    user_id: str
    applicant_email: str
    applicant_name: str
    role_code: str
    status: str
    justification: str
    reviewed_by: str | None
    reviewed_at: datetime | None
    rejection_reason_code: str | None
    rejection_reason_text: str | None
    created_at: datetime
    updated_at: datetime
