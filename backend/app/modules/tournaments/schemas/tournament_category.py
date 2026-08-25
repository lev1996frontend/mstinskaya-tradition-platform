from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TournamentCategoryCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class TournamentCategoryResponse(BaseModel):
    id: str
    tournament_id: str
    name: str
    description: str | None = None
