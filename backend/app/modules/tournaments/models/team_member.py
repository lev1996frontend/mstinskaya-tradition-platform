from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.athletes.models import Athlete
    from .team import Team


class TeamMember(Base):
    __tablename__ = "competition_team_members"
    __table_args__ = (UniqueConstraint("team_id", "athlete_id", name="uq_competition_team_members_team_athlete"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("competition_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    athlete_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    team: Mapped[Team] = relationship("Team", back_populates="members")
    athlete: Mapped[Athlete] = relationship("Athlete")
