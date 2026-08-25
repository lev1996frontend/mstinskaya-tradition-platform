from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.identity.models import User
    from app.modules.rules.models import RuleSet
    from .match import Match
    from .competition import Competition
    from .participant import Participant
    from .tournament_category import TournamentCategory
    from .tournament_document import TournamentDocument


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    organizer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ruleset_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("rule_sets.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organizer: Mapped[User] = relationship("User", backref="organized_tournaments")
    ruleset: Mapped[RuleSet] = relationship("RuleSet", backref="tournaments")
    categories: Mapped[list[TournamentCategory]] = relationship(back_populates="tournament", cascade="all, delete-orphan")
    participants: Mapped[list[Participant]] = relationship(back_populates="tournament", cascade="all, delete-orphan")
    matches: Mapped[list[Match]] = relationship(back_populates="tournament", cascade="all, delete-orphan")
    competitions: Mapped[list[Competition]] = relationship(back_populates="tournament", cascade="all, delete-orphan")
    documents: Mapped[list[TournamentDocument]] = relationship(back_populates="tournament", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Tournament(id={self.id!r}, title={self.title!r}, status={self.status!r})"
