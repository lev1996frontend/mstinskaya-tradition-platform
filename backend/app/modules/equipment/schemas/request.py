from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RequestStatus = Literal["NEW", "REVIEW", "APPROVED", "REJECTED"]


class EquipmentRequestCreateRequest(BaseModel):
    user_id: str
    product_id: str
    quantity: int = Field(default=1, ge=1)
    comment: str | None = Field(default=None, max_length=2000)
    status: RequestStatus = "NEW"


class EquipmentRequestResponse(BaseModel):
    id: str
    user_id: str
    product_id: str
    quantity: int
    comment: str | None = None
    status: RequestStatus
