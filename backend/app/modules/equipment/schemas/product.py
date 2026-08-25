from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ProductStatus = Literal["ACTIVE", "INACTIVE", "DRAFT"]


class EquipmentProductCreateRequest(BaseModel):
    category_id: str
    supplier_id: str | None = None
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    manufacturer: str | None = Field(default=None, max_length=150)
    price: float = Field(..., ge=0)
    currency: str = Field(default="BYN", min_length=3, max_length=10)
    status: ProductStatus = "ACTIVE"


class EquipmentProductResponse(BaseModel):
    id: str
    category_id: str
    supplier_id: str | None = None
    name: str
    description: str | None = None
    manufacturer: str | None = None
    price: float
    currency: str
    status: ProductStatus
