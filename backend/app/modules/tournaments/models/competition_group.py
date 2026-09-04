from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .competition import Competition
    from .draw import Draw
    from .participant import Participant


class CompetitionGroup(Base):
    """One subgroup of a group stage — «Группа А», «Группа Б».

    A table of its own rather than a reuse of :class:`Bracket`, which is
    documented and used as one row per *match slot*: a group container in there
    would make ``list_brackets`` and ``bracket_tree`` return rows that look like
    slots and are not.

    Nothing about the standings is stored here. A group's table is derived from
    recorded results on read, exactly like every other standings view — a
    second copy would be a second source of truth, and ``docs/tournament-
    engine.md`` is explicit that only the decision is stored.
    """

    __tablename__ = "competition_groups"
    __table_args__ = (UniqueConstraint("competition_id", "ordinal", name="uq_group_ordinal"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    competition_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    draw_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("competition_draws.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    #: 1-based. This is what the cross-seeding reads when it lays qualifiers out
    #: as A1, B1, A2, B2 — the order of the groups is part of the playoff shape.
    ordinal: Mapped[int] = mapped_column(nullable=False)
    #: Snapshot of the organizer's choice, per group rather than per competition,
    #: so editing the setting later cannot retroactively change what happened.
    advance_count: Mapped[int] = mapped_column(nullable=False, default=2)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    competition: Mapped[Competition] = relationship("Competition")
    draw: Mapped[Draw | None] = relationship("Draw")
    participants: Mapped[list[Participant]] = relationship(
        "Participant", back_populates="group"
    )

    def __repr__(self) -> str:
        return f"CompetitionGroup(id={self.id!r}, name={self.name!r}, ordinal={self.ordinal!r})"
