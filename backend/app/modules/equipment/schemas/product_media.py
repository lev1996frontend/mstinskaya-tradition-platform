from __future__ import annotations

from pydantic import BaseModel, Field


class ProductMediaCreateRequest(BaseModel):
    product_id: str
    media_file_id: str
    order_number: int = Field(default=1, ge=1)


class ProductMediaResponse(BaseModel):
    id: str
    product_id: str
    media_file_id: str
    order_number: int
