from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.athletes.models import Athlete
    from app.modules.tournaments.models import Tournament, TournamentCategory


class AthleteCompetition(Base):
    __tablename__ = "athlete_competitions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    athlete_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("athletes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tournament_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    place: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result: Mapped[str] = mapped_column(String(20), nullable=False, default="PARTICIPANT")
    matches_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wins_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    losses_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    athlete: Mapped[Athlete] = relationship("Athlete", backref="athlete_competitions")
    tournament: Mapped[Tournament] = relationship("Tournament", backref="athlete_competitions")
    category: Mapped[TournamentCategory] = relationship("TournamentCategory", backref="athlete_competitions")

    def __repr__(self) -> str:
        return f"AthleteCompetition(id={self.id!r}, athlete_id={self.athlete_id!r}, result={self.result!r})"
