from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SupplierCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    website: str | None = Field(default=None, max_length=500)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)


class SupplierResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    country: str | None = None
