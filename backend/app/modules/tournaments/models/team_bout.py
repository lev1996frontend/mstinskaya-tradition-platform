from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .competition import Competition
    from .match import Match
    from .team import Team


class TeamBout(Base):
    """A **трое на трое** meeting between two three-person teams.

    Deliberately thin: it owns no fight logic of its own. It groups three
    ordinary ``Match`` rows — one per individual pairing — so the lot, соступ and
    win-condition machinery is exactly the same as in an individual competition,
    and the team result is the aggregate of the three pairings.
    """

    __tablename__ = "team_bouts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    competition_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_red_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_blue_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Round-robin round index, for ordering the schedule.
    round_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: SCHEDULED | IN_PROGRESS | FINISHED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="SCHEDULED")
    #: Aggregate pairing wins, recomputed whenever a pairing finishes.
    wins_red: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wins_blue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    winner_team_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_teams.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    competition: Mapped[Competition] = relationship("Competition")
    team_red: Mapped[Team] = relationship("Team", foreign_keys=[team_red_id])
    team_blue: Mapped[Team] = relationship("Team", foreign_keys=[team_blue_id])
    pairings: Mapped[list[Match]] = relationship("Match", back_populates="team_bout")

    def __repr__(self) -> str:
        return f"TeamBout(id={self.id!r}, status={self.status!r})"
