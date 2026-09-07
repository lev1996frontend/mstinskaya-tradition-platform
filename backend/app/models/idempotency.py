"""Idempotency key: a repeated request returns the answer of the first one.

Lives in ``app/models`` rather than inside a domain: the mechanism knows
nothing about tournaments, and any future "commit a batch" endpoint will need
it too — that shape keeps recurring.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    #: The client makes the key up, once per attempt. The primary key here is
    #: not an optimization — it is the whole mechanism: a concurrent second
    #: request runs into it and so cannot claim the same row alongside the
    #: first.
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    endpoint: Mapped[str] = mapped_column(String(200), nullable=False)
    #: Empty until the first request has finished its work.
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
