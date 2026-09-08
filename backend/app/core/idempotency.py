"""Claim the key before the work, return the earlier answer instead of redoing it.

The order matters and is not interchangeable: the key is claimed **before**
the request does anything. On Postgres, a concurrent second request's claim
insert BLOCKS on the first request's row lock — for the whole duration of the
first request, not just an instant — because both requests fight over the same
primary key. When the lock releases:

- the first request committed: the second's insert raises ``IntegrityError``,
  and by then the first request's answer is sitting in the very row that was
  collided with, so the second request re-reads it and returns it — no 409;
- the first request rolled back (it failed): the row is gone, and the second
  request's insert succeeds and proceeds to do the work itself.

409 is reserved for the one case that means the first request is still
running: the row exists but ``response`` is still ``None``. That can only be
observed without blocking — e.g. a second request arriving while the first is
mid-flight in the same event loop — since a blocking claim insert only ever
wakes up after the first request's transaction has already ended one way or
the other.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idempotency import IdempotencyKey

_STILL_IN_FLIGHT = HTTPException(
    status_code=409,
    detail="Этот запрос уже выполняется. Подождите ответа первого.",
)


async def _find(session: AsyncSession, key: str, endpoint: str) -> IdempotencyKey | None:
    return await session.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.key == key, IdempotencyKey.endpoint == endpoint
        )
    )


async def remembered_response(
    session: AsyncSession, key: str | None, endpoint: str
) -> dict | None:
    """The earlier request's answer, or ``None`` — in which case the key is now claimed.

    ``None`` for ``key`` means the client sent no header: behave exactly as
    before. The key is optional so an old client keeps working.
    """
    if not key:
        return None

    existing = await _find(session, key, endpoint)
    if existing is not None:
        if existing.response is None:
            # A row with no stored answer, seen without blocking, means the
            # first request is genuinely still in flight (see module
            # docstring): there is no answer yet to hand back.
            raise _STILL_IN_FLIGHT
        return existing.response

    session.add(IdempotencyKey(key=key, endpoint=endpoint, response=None))
    try:
        await session.flush()
    except IntegrityError as clash:
        await session.rollback()
        # The insert only reaches here after waiting out the first request's
        # row lock, so that request has already finished. If it committed, its
        # answer is now stored under the row we collided with — return it
        # instead of making the organizer retry a request that already
        # succeeded. If it rolled back, no answer was ever stored, and that is
        # the one real 409: something is genuinely still wrong.
        existing = await _find(session, key, endpoint)
        if existing is not None and existing.response is not None:
            return existing.response
        raise _STILL_IN_FLIGHT from clash
    return None


async def remember_response(
    session: AsyncSession, key: str | None, endpoint: str, response: dict
) -> None:
    """Store the answer on the claimed key. Called before ``session.commit()``."""
    if not key:
        return
    claimed = await _find(session, key, endpoint)
    if claimed is not None:
        claimed.response = response
