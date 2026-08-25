from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EquipmentCategoryCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    parent_id: str | None = None


class EquipmentCategoryResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    parent_id: str | None = None
