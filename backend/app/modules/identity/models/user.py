from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from .profile import Profile
    from .role import Role
    from .user_role import UserRole


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    #: NULL until the user clicks the link in their verification email.
    #: Deliberate, documented exception to `docs/clubs-domain.md` rule 5
    #: ("Identity module must not be modified") — see
    #: docs/superpowers/specs/2026-09-14-email-verification-design.md.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: NULL for accounts registered before this column existed; set once, at
    #: registration, by `AuthService.register_user` below — never backfilled
    #: for existing accounts, since that would misrepresent when consent was
    #: actually given.
    privacy_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    profile: Mapped[Profile | None] = relationship(back_populates="user", cascade="all, delete-orphan")
    user_roles: Mapped[list[UserRole]] = relationship(back_populates="user", cascade="all, delete-orphan")
    roles: Mapped[list[Role]] = relationship(
        secondary="user_roles",
        back_populates="users",
        viewonly=False,
    )

    def __repr__(self) -> str:
        return f"User(id={self.id!r}, email={self.email!r})"
