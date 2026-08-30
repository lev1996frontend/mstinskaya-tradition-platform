from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .bracket import Bracket
    from .competition import Competition
    from .draw import Draw
    from .match_lot import MatchLot
    from .match_result import MatchResult
    from .match_round import MatchRound
    from app.modules.identity.models import User
    from .judge_assignment import JudgeAssignment
    from .match_decision import MatchDecision
    from .participant import Participant
    from .team_bout import TeamBout
    from .tournament import Tournament
    from .tournament_category import TournamentCategory


class Match(Base):
    """One **поединок** — a pairing of two fighters, or a bye slot.

    ``status`` carries the bout lifecycle. The vocabulary grew for the lot
    mechanic and is now::

        SCHEDULED -> READY_FOR_LOT -> LOT_COMPLETED -> IN_PROGRESS -> FINISHED

    A final-stage bout skips the two lot states (``SCHEDULED -> READY ->
    IN_PROGRESS -> FINISHED``), because the final is drawn no lot at all.
    ``FINISHED`` is the persisted spelling of the spec's ``COMPLETED``; it was
    already in use across the existing API and tests, so it was kept rather than
    forked into a second, incompatible enum. ``CANCELLED`` remains a terminal
    state reachable from anywhere.
    """

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

    # ---- generated-bracket wiring -------------------------------------- #
    #: True for a slot where one side is empty because the field was not a power
    #: of two. A bye is a real row with a real winner, never an invisible gap.
    is_bye: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    #: The match this one's winner feeds into — the single source of truth for
    #: advancement. Nothing on the client ever moves a name between rounds.
    next_match_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("matches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: Which side of ``next_match_id`` the winner occupies: "RED" or "BLUE".
    next_slot: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # ---- lot / соступ -------------------------------------------------- #
    #: Weapon fixed in advance for a final-stage bout, where no lot is drawn.
    #: Applies to both fighters; ``None`` means the organizer left it open and
    #: the judge records the соступ winners without a weapon on record.
    final_weapon: Mapped[str | None] = mapped_column(String(20), nullable=True)
    #: How many соступ each side must win, derived from the drawn weapons by
    #: ``domain.rules.win_condition`` and frozen here once the lot completes so
    #: the requirement stays visible and auditable after the fact.
    required_rounds_red: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required_rounds_blue: Mapped[int | None] = mapped_column(Integer, nullable=True)

    team_bout_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("team_bouts.id", ondelete="CASCADE"), nullable=True, index=True
    )

    competition: Mapped[Competition | None] = relationship("Competition", back_populates="matches")
    next_match: Mapped[Match | None] = relationship("Match", remote_side=[id], foreign_keys=[next_match_id])
    team_bout: Mapped[TeamBout | None] = relationship("TeamBout", back_populates="pairings")
    lots: Mapped[list[MatchLot]] = relationship(
        "MatchLot", back_populates="match", cascade="all, delete-orphan"
    )
    rounds: Mapped[list[MatchRound]] = relationship(
        "MatchRound", back_populates="match", cascade="all, delete-orphan"
    )
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

    @property
    def is_final(self) -> bool:
        """The final поединок draws no lot — enforced server-side, not just hidden."""
        return (self.stage_name or "").upper() == "FINAL"
    participant_red: Mapped[Participant | None] = relationship(foreign_keys=[participant_red_id], back_populates="matches_as_red")
    participant_blue: Mapped[Participant | None] = relationship(foreign_keys=[participant_blue_id], back_populates="matches_as_blue")
    winner: Mapped[Participant | None] = relationship(foreign_keys=[winner_id], back_populates="winner_decisions")
    judge_assignments: Mapped[list[JudgeAssignment]] = relationship(back_populates="match", cascade="all, delete-orphan")
    decisions: Mapped[list[MatchDecision]] = relationship(back_populates="match", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Match(id={self.id!r}, status={self.status!r})"
