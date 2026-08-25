from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .product import EquipmentProduct


class EquipmentCategory(Base):
    __tablename__ = "equipment_categories"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    parent: Mapped[EquipmentCategory | None] = relationship("EquipmentCategory", remote_side="EquipmentCategory.id", back_populates="children")
    children: Mapped[list[EquipmentCategory]] = relationship("EquipmentCategory", back_populates="parent")
    products: Mapped[list[EquipmentProduct]] = relationship("EquipmentProduct", back_populates="category")

    def __repr__(self) -> str:
        return f"EquipmentCategory(id={self.id!r}, name={self.name!r})"
