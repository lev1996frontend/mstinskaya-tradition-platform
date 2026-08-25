from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentBase(BaseModel):
    media_file_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    document_type: str = Field(default="MANUAL", min_length=1, max_length=20)


class DocumentCreate(DocumentBase):
    pass


class DocumentRead(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
