from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.athletes.models import Athlete


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    athlete_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("athletes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    award_type: Mapped[str] = mapped_column(String(50), nullable=False, default="achievement")
    issued_date: Mapped[datetime | None] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=True)
    earned_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    athlete: Mapped[Athlete] = relationship("Athlete", backref="achievements")

    @property
    def type(self) -> str:
        return self.award_type

    @type.setter
    def type(self, value: str) -> None:
        self.award_type = value

    @property
    def award_type_value(self) -> str:
        return self.award_type

    def __repr__(self) -> str:
        return f"Achievement(id={self.id!r}, athlete_id={self.athlete_id!r}, title={self.title!r})"
