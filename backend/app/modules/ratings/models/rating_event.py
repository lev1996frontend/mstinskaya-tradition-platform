from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.athletes.models import Athlete


class RatingEvent(Base):
    __tablename__ = "rating_events"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    athlete_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("athletes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    delta: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    previous_rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    new_rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    athlete: Mapped[Athlete] = relationship("Athlete", backref="rating_events")

    @property
    def points(self) -> float:
        return self.delta

    @points.setter
    def points(self, value: float) -> None:
        self.delta = float(value)

    def __repr__(self) -> str:
        return f"RatingEvent(id={self.id!r}, athlete_id={self.athlete_id!r}, delta={self.delta!r})"
