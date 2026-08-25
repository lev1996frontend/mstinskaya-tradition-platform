from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClubCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    country: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    website_url: str | None = Field(default=None, max_length=500)
    logo_url: str | None = Field(default=None, max_length=500)


class ClubResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    country: str | None = None
    city: str | None = None
    website_url: str | None = None
    logo_url: str | None = None
    is_active: bool


class ClubMemberCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: str
    role: Literal["OWNER", "INSTRUCTOR", "MEMBER", "JUDGE"] = "MEMBER"


class ClubMemberResponse(BaseModel):
    id: str
    club_id: str
    user_id: str
    role: Literal["OWNER", "INSTRUCTOR", "MEMBER", "JUDGE"]
