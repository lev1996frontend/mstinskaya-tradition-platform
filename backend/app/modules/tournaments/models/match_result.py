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


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    match_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    winner_participant_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tournament_participants.id", ondelete="SET NULL"), nullable=True)
    result_type: Mapped[str] = mapped_column(String(30), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    match: Mapped[Match] = relationship("Match", back_populates="result")
    winner_participant: Mapped[Participant | None] = relationship("Participant")

    @property
    def winner_id(self) -> UUID | None:
        return self.winner_participant_id

    @property
    def method(self) -> str:
        return self.result_type

    @property
    def comment(self) -> str | None:
        return self.notes
