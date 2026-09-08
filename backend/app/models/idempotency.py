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

    #: The client makes the key up, once per attempt. The primary key is
    #: composite with ``endpoint`` — not an optimization, it is the whole
    #: mechanism: every query filters on ``(key, endpoint)``, and the same key
    #: reused against a different endpoint (endpoint strings embed the
    #: tournament id, so this is reachable) must not collide with an unrelated
    #: claim. A concurrent second request for the *same* endpoint still runs
    #: into this row and so cannot claim it alongside the first.
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    endpoint: Mapped[str] = mapped_column(String(200), primary_key=True)
    #: Empty until the first request has finished its work.
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
