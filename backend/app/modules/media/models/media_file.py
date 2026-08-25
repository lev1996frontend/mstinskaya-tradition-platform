from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.identity.models import User
    from .content_access import ContentAccess
    from .document import Document
    from .video import Video


class MediaFile(Base):
    __tablename__ = "media_files"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="DOCUMENT")
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uploaded_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    uploader: Mapped[User] = relationship("User", backref="uploaded_media")
    video: Mapped[Video | None] = relationship(
        "Video",
        foreign_keys="[Video.media_file_id]",
        back_populates="media_file",
        cascade="all, delete-orphan",
    )
    document: Mapped[Document | None] = relationship(
        "Document",
        foreign_keys="[Document.media_file_id]",
        back_populates="media_file",
        cascade="all, delete-orphan",
    )
    access_entries: Mapped[list[ContentAccess]] = relationship(
        "ContentAccess",
        foreign_keys="[ContentAccess.media_file_id]",
        back_populates="media_file",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"MediaFile(id={self.id!r}, filename={self.filename!r}, type={self.type!r})"
