"""Claim the key before the work, return the earlier answer instead of redoing it.

The order matters and is not interchangeable: the key is claimed **before**
the request does anything. A concurrent second request with the same key then
cannot pass the same validation against a still-empty database and enter the
same people twice — its own claim insert conflicts with the first request's
row on the table's primary key, and it answers 409 immediately rather than
waiting for the first request to finish.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idempotency import IdempotencyKey


async def remembered_response(
    session: AsyncSession, key: str | None, endpoint: str
) -> dict | None:
    """The earlier request's answer, or ``None`` — in which case the key is now claimed.

    ``None`` for ``key`` means the client sent no header: behave exactly as
    before. The key is optional so an old client keeps working.
    """
    if not key:
        return None

    existing = await session.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.key == key, IdempotencyKey.endpoint == endpoint
        )
    )
    if existing is not None:
        if existing.response is None:
            # The first request claimed this key and has not stored an answer
            # yet. Under session-per-request with a single commit that first
            # request has already failed or is racing this one; either way the
            # second request has no answer to hand back and must not redo the
            # work, so it reports the conflict instead.
            raise HTTPException(
                status_code=409,
                detail="Этот запрос уже выполняется. Подождите ответа первого.",
            )
        return existing.response

    session.add(IdempotencyKey(key=key, endpoint=endpoint, response=None))
    try:
        await session.flush()
    except IntegrityError as clash:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Этот запрос уже выполняется. Подождите ответа первого.",
        ) from clash
    return None


async def remember_response(
    session: AsyncSession, key: str | None, endpoint: str, response: dict
) -> None:
    """Store the answer on the claimed key. Called before ``session.commit()``."""
    if not key:
        return
    claimed = await session.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.key == key, IdempotencyKey.endpoint == endpoint
        )
    )
    if claimed is not None:
        claimed.response = response
