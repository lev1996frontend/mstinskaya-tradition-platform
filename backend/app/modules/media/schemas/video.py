from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VideoBase(BaseModel):
    media_file_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    preview_image_id: UUID | None = None
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    thumbnail_key: str | None = Field(default=None, max_length=500)
    thumbnail_url: str | None = Field(default=None, max_length=1000)
    is_processed: bool = False


class VideoCreate(VideoBase):
    pass


class VideoRead(VideoBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
