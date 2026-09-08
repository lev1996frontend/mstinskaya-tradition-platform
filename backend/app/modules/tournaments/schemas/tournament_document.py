from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DocumentType = Literal["RULES", "POSITION", "RESULTS"]


class TournamentDocumentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    #: Either an uploaded file or a link to somewhere else — never neither. A
    #: document row with no address is a title that points at nothing.
    media_file_id: str | None = None
    file_url: str | None = Field(default=None, max_length=500)
    type: DocumentType = "RULES"

    @model_validator(mode="after")
    def _needs_an_address(self) -> "TournamentDocumentCreateRequest":
        if not self.media_file_id and not self.file_url:
            raise ValueError("Нужен либо загруженный файл, либо ссылка.")
        return self


class TournamentDocumentResponse(BaseModel):
    id: str
    tournament_id: str
    title: str
    file_url: str
    type: DocumentType
