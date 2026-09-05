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
    #: The tournament category this discipline *is*. «Абсолютная детская» and
    #: «Ветераны» are two disciplines of one tournament, each with its own
    #: field, its own bracket and its own champion, so the category belongs
    #: here rather than being guessed per entry.
    category_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    #: Age bounds, each independently optional and both usually absent. 45+ for
    #: «Ветераны», an upper bound for a children's category, neither for the
    #: open adult absolute — which is what lets a fifty-year-old enter both.
    #: Counted as whole years reached during the year of the event; see
    #: `domain/eligibility.py`.
    min_age: Mapped[int | None] = mapped_column(nullable=True)
    max_age: Mapped[int | None] = mapped_column(nullable=True)
    #: Largest age difference allowed inside one bracket, in whole years. Null
    #: — and it is null everywhere until an organizer sets it — means the
    #: discipline fights as one field, which is how every adult category works.
    #: Set on a children's category, it lets the platform cut the entrants into
    #: age streams instead of putting an eight-year-old opposite a fourteen-
    #: year-old. The number itself is the organizer's: a safety rule is not
    #: something this codebase may invent (``docs/domain-model.md`` §5).
    max_age_gap: Mapped[int | None] = mapped_column(nullable=True)
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
