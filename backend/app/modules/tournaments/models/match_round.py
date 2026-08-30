from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .match import Match
    from .participant import Participant


class MatchRound(Base):
    """One **соступ** — a single exchange inside a поединок.

    A поединок is at most three соступ (``rules.MAX_ROUNDS_PER_BOUT``); how many
    a side must win to take the поединок depends on the drawn weapons and is
    computed by ``rules.win_condition``, not stored as a flat "best of 3".

    Points are the confirmed per-соступ tally (to three). They are ``None`` for
    a соступ where either fighter holds кистень, because no source defines
    kistenʹ strike values — such a соступ carries a binary winner only, and the
    schema says so rather than filling in invented numbers.
    """

    __tablename__ = "match_rounds"
    __table_args__ = (
        UniqueConstraint("match_id", "round_number", name="uq_match_rounds_match_number"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    match_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: 1..3
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    #: IN_PROGRESS | COMPLETED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="IN_PROGRESS")
    points_red: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    points_blue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    winner_participant_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    #: POINTS | CLEAN_HIT | DISARM | KISTEN_CLEAN | JUDGE_DECISION | WITHDRAWAL
    end_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    match: Mapped[Match] = relationship("Match", back_populates="rounds")
    winner: Mapped[Participant | None] = relationship("Participant", foreign_keys=[winner_participant_id])
    scores: Mapped[list[RoundScore]] = relationship(
        "RoundScore", back_populates="round", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"MatchRound(match_id={self.match_id!r}, round_number={self.round_number!r})"


class RoundScore(Base):
    """One judge-recorded scoring event inside a соступ.

    Storing the individual touches rather than only a final tally is what makes
    the confirmed point tiers real: the соступ total is derived from these rows,
    and every touch names the action the judge actually called.
    """

    __tablename__ = "match_round_scores"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    round_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("match_rounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: A key of ``domain.rules.SCORING_ACTIONS``.
    action_code: Mapped[str] = mapped_column(String(30), nullable=False)
    weapon: Mapped[str] = mapped_column(String(20), nullable=False)
    #: ``None`` where the source defines no point value (кистень, disarm).
    points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorded_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    round: Mapped[MatchRound] = relationship("MatchRound", back_populates="scores")

    def __repr__(self) -> str:
        return f"RoundScore(round_id={self.round_id!r}, action_code={self.action_code!r})"
