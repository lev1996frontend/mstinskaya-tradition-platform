from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .participant import Participant


class ParticipantStatusHistory(Base):
    __tablename__ = "participant_status_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    participant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tournament_participants.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    participant: Mapped[Participant] = relationship("Participant", back_populates="status_history")

    @property
    def old_status(self) -> str | None:
        return self.from_status

    @property
    def new_status(self) -> str:
        return self.to_status

    @property
    def created_at(self) -> datetime:
        return self.changed_at
