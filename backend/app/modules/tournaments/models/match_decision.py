from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .match import Match
    from .participant import Participant


class MatchDecision(Base):
    __tablename__ = "match_decisions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    match_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    decision_type: Mapped[str] = mapped_column(String(20), nullable=False)
    winner_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tournament_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    match: Mapped[Match] = relationship(back_populates="decisions")
    winner: Mapped[Participant | None] = relationship("Participant", foreign_keys=[winner_id], backref="match_decisions")

    def __repr__(self) -> str:
        return f"MatchDecision(id={self.id!r}, decision_type={self.decision_type!r})"
