from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.athletes.models import Athlete
    from .competition import Competition
    from .team import Team
    from .participant_status_history import ParticipantStatusHistory
    from .match import Match
    from .tournament import Tournament
    from .tournament_category import TournamentCategory


class Participant(Base):
    __tablename__ = "tournament_participants"

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
    athlete_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("athletes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    competition_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    team_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    seed: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="REGISTERED")
    #: Registration city, used by the first-round city constraint. Kept on the
    #: entry rather than on ``Athlete`` because a fighter can move between
    #: events and past results must stay true to the city they entered under.
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    club_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    #: Club as written on the entry, and the input to the club half of the
    #: first-round separation. Free text rather than a lookup through
    #: ``club_id`` for the same reason ``city`` is: entries arrive from a
    #: spreadsheet naming a club that may match no row here, and a fighter who
    #: changes school later must not retroactively change which school they
    #: represented at this event. ``club_id`` is set additionally when the name
    #: does resolve, but the constraint never depends on it.
    club_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    #: Only consulted where the discipline sets an age bound. Kept on the entry
    #: because an entrant imported from a spreadsheet has no profile to read it
    #: from; a year rather than a date, matching what `Athlete` already stores.
    birth_year: Mapped[int | None] = mapped_column(nullable=True)
    #: Only for an entrant with no platform profile yet. When ``athlete_id`` is
    #: set the name always comes from that profile, so linking an existing
    #: athlete can never produce a duplicate identity.
    display_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tournament: Mapped[Tournament] = relationship(back_populates="participants")
    category: Mapped[TournamentCategory] = relationship(back_populates="participants")
    athlete: Mapped[Athlete] = relationship("Athlete", backref="tournament_participants")
    competition: Mapped[Competition | None] = relationship("Competition", back_populates="participants")
    team: Mapped[Team | None] = relationship("Team", back_populates="participants")
    status_history: Mapped[list[ParticipantStatusHistory]] = relationship("ParticipantStatusHistory", back_populates="participant", cascade="all, delete-orphan")

    @property
    def type(self) -> str:
        return "TEAM" if self.team_id is not None else "ATHLETE"
    matches_as_red: Mapped[list[Match]] = relationship(foreign_keys="Match.participant_red_id", back_populates="participant_red")
    matches_as_blue: Mapped[list[Match]] = relationship(foreign_keys="Match.participant_blue_id", back_populates="participant_blue")
    winner_decisions: Mapped[list[Match]] = relationship(foreign_keys="Match.winner_id", back_populates="winner")

    def __repr__(self) -> str:
        return f"Participant(id={self.id!r}, tournament_id={self.tournament_id!r}, athlete_id={self.athlete_id!r})"
