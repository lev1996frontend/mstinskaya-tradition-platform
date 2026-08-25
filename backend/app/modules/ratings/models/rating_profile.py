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


class RatingProfile(Base):
    __tablename__ = "rating_profiles"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    athlete_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("athletes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    wins: Mapped[int] = mapped_column(nullable=False, default=0)
    losses: Mapped[int] = mapped_column(nullable=False, default=0)
    draws: Mapped[int] = mapped_column(nullable=False, default=0)
    tier: Mapped[str] = mapped_column(String(50), nullable=False, default="unranked")
    last_calculated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    athlete: Mapped[Athlete] = relationship("Athlete", backref="rating_profile")

    @property
    def rating_points(self) -> float:
        return self.rating

    @rating_points.setter
    def rating_points(self, value: float) -> None:
        self.rating = float(value)

    @property
    def rank_position(self) -> int | None:
        return None

    @rank_position.setter
    def rank_position(self, value: int | None) -> None:
        return None

    def __repr__(self) -> str:
        return f"RatingProfile(id={self.id!r}, athlete_id={self.athlete_id!r}, rating={self.rating!r})"
