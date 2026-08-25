from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DECIMAL, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.identity.models import User
    from .category import EquipmentCategory
    from .product_media import ProductMedia
    from .request import EquipmentRequest
    from .supplier import Supplier


class EquipmentProduct(Base):
    __tablename__ = "equipment_products"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(150), nullable=True)
    price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="BYN")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    category: Mapped[EquipmentCategory] = relationship("EquipmentCategory", back_populates="products")
    supplier: Mapped[Supplier | None] = relationship("Supplier", back_populates="products")
    media: Mapped[list[ProductMedia]] = relationship("ProductMedia", back_populates="product", cascade="all, delete-orphan")
    requests: Mapped[list[EquipmentRequest]] = relationship("EquipmentRequest", back_populates="product", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"EquipmentProduct(id={self.id!r}, name={self.name!r}, status={self.status!r})"
