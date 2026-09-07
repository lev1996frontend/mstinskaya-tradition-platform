"""Занять ключ до работы, вернуть прежний ответ вместо повторной работы.

Порядок важен и обратному не эквивалентен: ключ занимается **до** того, как
запрос что-либо сделает. Тогда второй запрос с тем же ключом упирается в
первичный ключ таблицы и ждёт, вместо того чтобы параллельно пройти ту же
проверку на пустой базе и завести тех же людей второй раз.
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
    """Ответ прежнего запроса, либо ``None`` — и тогда ключ занят за нами.

    ``None`` в ключе означает «клиент не прислал заголовок»: работаем как
    раньше. Ключ необязателен, чтобы старый клиент не сломался.
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
            # Первый запрос ещё в работе. Второй не имеет права ни ждать его,
            # ни сделать то же самое: он говорит, что запрос уже принят.
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
    """Записать ответ в занятый ключ. Вызывается до ``session.commit()``."""
    if not key:
        return
    claimed = await session.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.key == key, IdempotencyKey.endpoint == endpoint
        )
    )
    if claimed is not None:
        claimed.response = response
