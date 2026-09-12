from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MediaFileBase(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    original_name: str = Field(..., min_length=1, max_length=255)
    storage_key: str = Field(..., min_length=1, max_length=500)
    url: str = Field(..., min_length=1, max_length=1000)
    type: str = Field(default="DOCUMENT", min_length=1, max_length=20)
    size: int | None = Field(default=None, ge=0)
    mime_type: str | None = Field(default=None, max_length=100)


class MediaFileCreate(MediaFileBase):
    """No `uploaded_by` here: the router derives it from the authenticated
    caller server-side, so a client cannot attribute a recorded file to
    someone else's id."""


class MediaFileRead(MediaFileBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    uploaded_by: UUID
    created_at: datetime
    updated_at: datetime
