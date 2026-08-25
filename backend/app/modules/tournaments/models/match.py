from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .bracket import Bracket
    from .competition import Competition
    from .draw import Draw
    from .match_result import MatchResult
    from app.modules.identity.models import User
    from .judge_assignment import JudgeAssignment
    from .match_decision import MatchDecision
    from .participant import Participant
    from .tournament import Tournament
    from .tournament_category import TournamentCategory


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tournament_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_categories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    participant_red_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    participant_blue_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="SCHEDULED")
    winner_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tournament: Mapped[Tournament] = relationship(back_populates="matches")
    category: Mapped[TournamentCategory] = relationship(back_populates="matches")
    competition_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    draw_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_draws.id", ondelete="SET NULL"), nullable=True, index=True
    )
    bracket_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_brackets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    round_number: Mapped[int | None] = mapped_column(nullable=True)
    position: Mapped[int | None] = mapped_column(nullable=True)
    stage_name: Mapped[str | None] = mapped_column(String(30), nullable=True)
    competition: Mapped[Competition | None] = relationship("Competition", back_populates="matches")
    draw: Mapped[Draw | None] = relationship("Draw", back_populates="matches")
    bracket: Mapped[Bracket | None] = relationship("Bracket", back_populates="matches")
    result: Mapped[MatchResult | None] = relationship("MatchResult", back_populates="match", uselist=False, cascade="all, delete-orphan")

    @property
    def participant_a_id(self) -> UUID | None:
        return self.participant_red_id

    @property
    def participant_b_id(self) -> UUID | None:
        return self.participant_blue_id

    @property
    def stage(self) -> str | None:
        return self.stage_name
    participant_red: Mapped[Participant | None] = relationship(foreign_keys=[participant_red_id], back_populates="matches_as_red")
    participant_blue: Mapped[Participant | None] = relationship(foreign_keys=[participant_blue_id], back_populates="matches_as_blue")
    winner: Mapped[Participant | None] = relationship(foreign_keys=[winner_id], back_populates="winner_decisions")
    judge_assignments: Mapped[list[JudgeAssignment]] = relationship(back_populates="match", cascade="all, delete-orphan")
    decisions: Mapped[list[MatchDecision]] = relationship(back_populates="match", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Match(id={self.id!r}, status={self.status!r})"
