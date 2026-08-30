from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .match import Match


class MatchLot(Base):
    """One recorded жребий — the weapon draw for one side of one поединок.

    Append-only. A second ordinary draw on the same side is refused by
    :class:`~app.modules.tournaments.services.bout_service.BoutService`; the only
    way to change a drawn weapon is the explicit admin-override path, which adds
    a *new* row with the next ``sequence`` and marks the old one superseded. The
    original draw therefore never disappears, and the unique constraint on
    ``(match_id, side, sequence)`` keeps the chain honest.
    """

    __tablename__ = "match_lots"
    __table_args__ = (
        UniqueConstraint("match_id", "side", "sequence", name="uq_match_lots_match_side_sequence"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    match_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: "RED" or "BLUE", matching ``Match.participant_red_id`` / ``participant_blue_id``.
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    #: 1 for the original draw, 2+ for successive admin corrections.
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    #: False once a later override replaced this draw.
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    participant_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    #: PHYSICAL_DICE (a judge entered the face of a real die) or ONLINE_DICE
    #: (the server rolled it with `secrets`). Never a value the browser chose.
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    #: The d4 face, recorded for both methods so the two are auditable alike.
    die_value: Mapped[int] = mapped_column(Integer, nullable=False)
    weapon: Mapped[str] = mapped_column(String(20), nullable=False)
    drawn_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    match: Mapped[Match] = relationship("Match", back_populates="lots")

    def __repr__(self) -> str:
        return f"MatchLot(match_id={self.match_id!r}, side={self.side!r}, weapon={self.weapon!r})"
