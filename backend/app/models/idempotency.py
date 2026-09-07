"""Ключ идемпотентности: повтор запроса возвращает прежний ответ.

Живёт в ``app/models``, а не внутри домена: механизм ничего не знает про
турниры и понадобится любому будущему «занесению» — а такие всегда появляются.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    #: Ключ придумывает клиент, один раз на сеанс. Первичный ключ здесь —
    #: не оптимизация, а весь механизм: одновременный второй запрос упирается
    #: в него и потому не может пройти проверку параллельно с первым.
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    endpoint: Mapped[str] = mapped_column(String(200), nullable=False)
    #: Пусто, пока первый запрос не закончил работу.
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
