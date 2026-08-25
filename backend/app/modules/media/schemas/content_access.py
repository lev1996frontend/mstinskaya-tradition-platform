from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContentAccessBase(BaseModel):
    media_file_id: UUID
    access_level: str = "USER"


class ContentAccessCreate(ContentAccessBase):
    pass


class ContentAccessRead(ContentAccessBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
