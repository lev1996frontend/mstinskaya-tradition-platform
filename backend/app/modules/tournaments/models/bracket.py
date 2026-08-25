from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .competition import Competition
    from .draw import Draw
    from .match import Match


class Bracket(Base):
    __tablename__ = "competition_brackets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    competition_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False, index=True)
    draw_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("competition_draws.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    stage_type: Mapped[str] = mapped_column(String(30), nullable=False)
    round_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    round: Mapped[int | str | None] = mapped_column(String(30), nullable=True)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    competition: Mapped[Competition] = relationship("Competition", back_populates="brackets")
    draw: Mapped[Draw | None] = relationship("Draw", back_populates="brackets")
    matches: Mapped[list[Match]] = relationship("Match", back_populates="bracket")
