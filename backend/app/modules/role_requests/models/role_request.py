from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

#: Requestable roles. `USER` is excluded — it is granted automatically at
#: registration (`AuthService.register_user`), never requested. `MODERATOR`
#: is excluded too — it grants access to this very review queue, so a new
#: moderator may only be appointed by an existing one via
#: `app.core.identity_access.assign_role`, not requested self-service.
#: Mirrored by `REQUESTABLE_ROLES` in
#: frontend/src/features/role-requests/role-request-panel.tsx — nothing
#: enforces the two stay in sync, so change both together.
ROLE_CODES = ("INSTRUCTOR", "ORGANIZER", "JUDGE")
REJECTION_REASON_CODES = ("INSUFFICIENT_EVIDENCE", "NOT_RECOGNIZED", "DUPLICATE_REQUEST", "OTHER")


class RoleRequest(Base):
    __tablename__ = "role_requests"
    __table_args__ = (
        #: At most one PENDING request per (user, role); a resolved request
        #: never blocks a fresh one — see
        #: docs/superpowers/specs/2026-09-15-role-requests-design.md.
        #: `sqlite_where` mirrors `postgresql_where` so the constraint also
        #: holds under the sqlite-backed test suite (CLAUDE.md's test setup),
        #: not just against real Postgres.
        Index(
            "uq_role_requests_pending_user_role",
            "user_id",
            "role_code",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
            sqlite_where=text("status = 'PENDING'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_code: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    justification: Mapped[str] = mapped_column(String(2000), nullable=False)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rejection_reason_text: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"RoleRequest(id={self.id!r}, user_id={self.user_id!r}, role_code={self.role_code!r}, status={self.status!r})"
