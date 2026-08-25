from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DocumentType = Literal["RULES", "POSITION", "RESULTS"]


class TournamentDocumentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    file_url: str = Field(..., max_length=500)
    type: DocumentType = "RULES"


class TournamentDocumentResponse(BaseModel):
    id: str
    tournament_id: str
    title: str
    file_url: str
    type: DocumentType
