from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RuleSetDocumentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    media_file_id: str = Field(..., min_length=1)


class RuleSetDocumentResponse(BaseModel):
    id: str
    rule_set_id: str
    title: str
    media_file_id: str
    url: str
