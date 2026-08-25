from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .bracket import Bracket
    from .competition_event import CompetitionEvent
    from .draw import Draw
    from .match import Match
    from .participant import Participant
    from .team import Team
    from .tournament import Tournament


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tournament_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    competition_type: Mapped[str] = mapped_column(String(20), nullable=False, default="INDIVIDUAL")
    format: Mapped[str] = mapped_column(String(30), nullable=False, default="SINGLE_ELIMINATION")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    tournament: Mapped[Tournament] = relationship("Tournament", back_populates="competitions")
    participants: Mapped[list[Participant]] = relationship("Participant", back_populates="competition")
    teams: Mapped[list[Team]] = relationship("Team", back_populates="competition", cascade="all, delete-orphan")
    draws: Mapped[list[Draw]] = relationship("Draw", back_populates="competition", cascade="all, delete-orphan")
    brackets: Mapped[list[Bracket]] = relationship("Bracket", back_populates="competition", cascade="all, delete-orphan")
    matches: Mapped[list[Match]] = relationship("Match", back_populates="competition")
    events: Mapped[list[CompetitionEvent]] = relationship("CompetitionEvent", back_populates="competition", cascade="all, delete-orphan")

    @property
    def type(self) -> str:
        return self.competition_type
