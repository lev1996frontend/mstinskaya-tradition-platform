from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .rule_set import RuleSet


class RuleSetDocument(Base):
    """The Word file of one edition of the rules.

    A table rather than a column on `RuleSet` for two reasons: an edition has no
    file at all today, and editions are historical — `docs/architecture.md`
    forbids rewriting them, so the 1.0 file must survive the arrival of 2.0
    untouched.
    """

    __tablename__ = "rule_set_documents"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    rule_set_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("rule_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: RESTRICT, like tournament_documents: deleting the uploader's file out
    #: from under a cited edition should be refused, not silently propagated.
    media_file_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("media_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    #: Taken off the page, not deleted. The bytes and the download link stay
    #: alive because an old edition may already be cited or handed out.
    removed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)

    rule_set: Mapped[RuleSet] = relationship("RuleSet", back_populates="documents")

    def __repr__(self) -> str:
        return f"RuleSetDocument(id={self.id!r}, rule_set_id={self.rule_set_id!r}, title={self.title!r})"
