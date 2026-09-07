# Защита от двойного занесения — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дважды нажатая кнопка «Завести участников» и повторно отправленный
запрос не заводят людей дважды.

**Architecture:** Два средства на двух уровнях, и нужны оба. Доменный инвариант
«один профиль не может быть заявлен в одну дисциплину дважды» уезжает в схему
частичным уникальным индексом — он ловит одновременные запросы, которые оба
прошли проверку до того, как первый успел записать. Ключ идемпотентности на
коммите ловит тех участников, у кого нет привязанного профиля и потому индекс их
не видит: ключ занимается **до** работы, поэтому второй запрос упирается в
первичный ключ, а не в гонку.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, pytest + TestClient на
`sqlite+aiosqlite`, Next.js App Router.

**Spec:** `docs/superpowers/specs/2026-09-07-files-architecture.md`, раздел
«Повторная отправка одного и того же», уровень 3.

## Global Constraints

- Занесение всегда идёт через сервис домена (`create_participant`), никогда
  прямой записью в таблицу.
- Коммит перепроверяет присланное: клиент не авторитет.
- Всё или ничего: половина занесённой заявки хуже отклонённой.
- Уникальности **по имени** быть не должно: полные тёзки возможны, схема не
  вправе их запрещать.
- Тесты пишутся первыми и должны быть увидены падающими.
- Голова миграций на момент написания плана: `20260905_participant_replacement`.
- Прогон бэкенда: `cd backend && .venv/Scripts/python.exe -m pytest -q`.
  На Windows рабочий каталог оболочки общий с PowerShell — возвращайте его в
  корень репозитория перед git-командами.

## File Structure

| Файл | Ответственность |
| --- | --- |
| `backend/app/modules/tournaments/models/participant.py` | + `__table_args__` с частичным уникальным индексом |
| `backend/migrations/versions/20260907_double_entry_guards.py` | создать индекс и таблицу ключей, с внятной диагностикой при конфликте |
| `backend/app/models/idempotency.py` | модель `IdempotencyKey` (общая, не турнирная) |
| `backend/app/core/idempotency.py` | «занять ключ / вернуть прежний ответ» |
| `backend/app/modules/tournaments/routers/intake.py` | читать заголовок, отдавать прежний ответ |
| `backend/tests/test_double_entry_guards.py` | тесты обоих средств |
| `frontend/src/lib/api.ts` | `apiRequest` умеет слать заголовки |
| `frontend/src/api/tournaments.ts` | `commitParticipantImport` принимает ключ |
| `frontend/src/features/tournaments/participant-import-review.tsx` | ключ на сеанс просмотра |

---

### Task 1: Индекс — один профиль не заявляется в дисциплину дважды

**Files:**
- Modify: `backend/app/modules/tournaments/models/participant.py`
- Create: `backend/migrations/versions/20260907_double_entry_guards.py`
- Test: `backend/tests/test_double_entry_guards.py`

**Interfaces:**
- Consumes: ничего.
- Produces: индекс `uq_participant_athlete_per_competition` на
  `tournament_participants (competition_id, athlete_id)`, частичный —
  только там, где оба не пусты. Ревизия `20260907_double_entry_guards`,
  `down_revision = "20260905_participant_replacement"`.

- [ ] **Step 1: Написать падающий тест**

Создать `backend/tests/test_double_entry_guards.py`. Шапку (`setup_app_for_tests`,
`register`, `bootstrap`) скопировать из `backend/tests/test_participant_import_api.py`
— она там ровно та же, а общий conftest в проекте не заведён и заводить его в
этой задаче не надо.

```python
def test_one_profile_cannot_be_entered_twice_in_a_discipline():
    """Инвариант предметной области, а не защита от кликов, — потому в схеме."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    absolute = next(c for c in competitions if c["name"] == "Абсолютная мужская")

    athlete_id, _ = register_athlete(client, "boec@example.com", "Иван", "Иванов")

    first = client.post(
        f"/api/v1/competitions/{absolute['id']}/participants",
        json={"display_name": "Иван Иванов", "athlete_id": athlete_id},
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/api/v1/competitions/{absolute['id']}/participants",
        json={"display_name": "Иван Иванов", "athlete_id": athlete_id},
    )
    assert second.status_code == 409, second.text


def test_namesakes_without_profiles_are_still_allowed():
    """Полные тёзки — вещь возможная, и схема не вправе их запрещать."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    absolute = next(c for c in competitions if c["name"] == "Абсолютная мужская")

    for _ in range(2):
        created = client.post(
            f"/api/v1/competitions/{absolute['id']}/participants",
            json={"display_name": "Иван Иванов"},
        )
        assert created.status_code == 201, created.text
```

Хелпер `register_athlete` дописать в тот же файл — профиль атлета нужен, потому
что индекс частичный и на пустых `athlete_id` не срабатывает:

```python
def register_athlete(client, email: str, first_name: str, last_name: str) -> tuple[str, dict]:
    """Учётка с профилем бойца; возвращает id атлета и заголовки."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "first_name": first_name,
            "last_name": last_name,
        },
    )
    assert response.status_code == 201, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    user_id = client.get("/api/v1/users/me", headers=headers).json()["id"]
    athlete = client.post("/api/v1/athletes", json={"user_id": user_id})
    assert athlete.status_code == 201, athlete.text
    return athlete.json()["id"], headers
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_double_entry_guards.py -q -p no:warnings`

Expected: `test_one_profile_cannot_be_entered_twice_in_a_discipline` FAIL —
второй `POST` вернёт 201 вместо 409. Второй тест обязан пройти сразу: он
описывает поведение, которое уже есть, и стоит здесь сторожем, чтобы индекс не
оказался шире, чем нужно.

Если хелпер `register_athlete` упал на создании атлета — сверьтесь с
`POST /api/v1/athletes` в `backend/app/modules/athletes/routers/`, поле могло
называться иначе. Это ошибка теста, а не отсутствие возможности: чините и
перезапускайте, пока не увидите **осмысленное** падение.

- [ ] **Step 3: Объявить индекс на модели**

В `backend/app/modules/tournaments/models/participant.py` добавить импорт и
`__table_args__` сразу после `__tablename__`:

```python
from sqlalchemy import Index, text
```

```python
class Participant(Base):
    __tablename__ = "tournament_participants"

    #: Один и тот же профиль не может быть заявлен в одну дисциплину дважды —
    #: это правда о предметной области, а не защита от двойного клика, и потому
    #: живёт в схеме. Индекс частичный: у заявленного вручную бойца профиля может
    #: не быть вовсе, а по имени уникальности быть не должно — полные тёзки
    #: возможны, и запрещать их схемой нельзя.
    __table_args__ = (
        Index(
            "uq_participant_athlete_per_competition",
            "competition_id",
            "athlete_id",
            unique=True,
            postgresql_where=text("athlete_id IS NOT NULL AND competition_id IS NOT NULL"),
            sqlite_where=text("athlete_id IS NOT NULL AND competition_id IS NOT NULL"),
        ),
    )
```

`sqlite_where` обязателен: тесты поднимают схему через `Base.metadata.create_all`
на SQLite, и без него индекс в тестах будет полным — тогда упадёт тест про тёзок.

- [ ] **Step 4: Превратить нарушение индекса в 409**

`create_participant` сейчас упадёт `IntegrityError` — это 500, а не ответ. В
`backend/app/modules/tournaments/services/engine_service.py`, в
`create_participant`, обернуть запись:

```python
from sqlalchemy.exc import IntegrityError
```

```python
        session.add(item)
        try:
            await session.flush()
        except IntegrityError as clash:
            await session.rollback()
            raise HTTPException(
                status_code=409,
                detail="Этот боец уже заявлен в этой дисциплине.",
            ) from clash
```

Точное место: найдите в `create_participant` существующие `session.add(item)` и
следующий за ним `await session.flush()` и замените эту пару целиком.

- [ ] **Step 5: Прогнать новые тесты**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_double_entry_guards.py -q -p no:warnings`

Expected: PASS, оба.

- [ ] **Step 6: Прогнать всю сюиту — это настоящая проверка задачи**

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`

Expected: 234 passed.

Если упали тесты замены выбывшего (`test_participant_replacement*`) — значит,
движок где-то заводит вторую строку на того же атлета в той же дисциплине, и
инвариант из спека неверен. **Не ослабляйте индекс молча**: остановитесь и
сообщите, какой именно сценарий его нарушил. Это тот случай, когда падение
теста — сообщение архитектору, а не помеха.

- [ ] **Step 7: Написать миграцию**

Создать `backend/migrations/versions/20260907_double_entry_guards.py`. Стиль —
как у соседей: докстринг объясняет **почему**, а не что.

```python
"""дважды нажатая кнопка не заводит бойца дважды

Два средства на двух уровнях. Частичный уникальный индекс на
``(competition_id, athlete_id)`` — доменный инвариант: один профиль не может быть
заявлен в одну дисциплину дважды. По имени уникальности нет и не будет: полные
тёзки возможны, и запрещать их схемой нельзя.

Таблица ключей идемпотентности — для тех, у кого профиля нет и индекс их не
видит. Ключ занимается до работы, поэтому одновременный второй запрос упирается
в первичный ключ, а не в гонку чтения.

Индекс — единственное место здесь, способное упасть на живых данных. Если дубли
уже есть, ревизия называет их поимённо и останавливается: чинить данные молча
опаснее, чем не примениться.

Revision ID: 20260907_double_entry_guards
Revises: 20260905_participant_replacement
Create Date: 2026-09-07 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260907_double_entry_guards"
down_revision = "20260905_participant_replacement"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_participant_athlete_per_competition"
PARTIAL_WHERE = "athlete_id IS NOT NULL AND competition_id IS NOT NULL"


def upgrade() -> None:
    duplicates = op.get_bind().execute(
        sa.text(
            """
            SELECT competition_id, athlete_id, COUNT(*) AS n
            FROM tournament_participants
            WHERE athlete_id IS NOT NULL AND competition_id IS NOT NULL
            GROUP BY competition_id, athlete_id
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    if duplicates:
        listing = ", ".join(
            f"дисциплина {row.competition_id} / боец {row.athlete_id}: {row.n}"
            for row in duplicates
        )
        raise RuntimeError(
            "В базе уже есть повторно заявленные бойцы, индекс не создать. "
            f"Разберите эти пары и повторите: {listing}"
        )

    op.create_index(
        INDEX_NAME,
        "tournament_participants",
        ["competition_id", "athlete_id"],
        unique=True,
        postgresql_where=sa.text(PARTIAL_WHERE),
    )

    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("endpoint", sa.String(length=200), nullable=False),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_idempotency_keys_created_at", "idempotency_keys", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_idempotency_keys_created_at", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
    op.drop_index(INDEX_NAME, table_name="tournament_participants")
```

Таблица ключей создаётся здесь же, хотя пользуется ею задача 2: одна ревизия на
одно изменение схемы читается лучше двух, а модель для неё появится следующей
задачей и до тех пор просто не используется.

- [ ] **Step 8: Проверить миграцию на настоящем Postgres**

SQLite-сюита расхождений схемы не ловит — она поднимает таблицы из моделей и
миграции не исполняет. Порядок прогона на живой базе описан в памяти проекта
(«Postgres migration verification»); коротко:

Run: `cd backend && .venv/Scripts/python.exe -m alembic upgrade head`
Expected: ревизия применяется без ошибок.

Run: `cd backend && .venv/Scripts/python.exe -m alembic downgrade -1` затем снова `upgrade head`
Expected: оба направления проходят.

Если Postgres недоступен — **так и скажите в отчёте**, не выдавая непроверенное
за проверенное.

- [ ] **Step 9: Коммит**

```bash
git add backend/app/modules/tournaments/models/participant.py \
        backend/app/modules/tournaments/services/engine_service.py \
        backend/migrations/versions/20260907_double_entry_guards.py \
        backend/tests/test_double_entry_guards.py
git commit -m "feat(tournaments): one profile cannot be entered twice in a discipline

The claim is about the sport, not about clicking: the same fighter's profile in
one discipline twice is not a thing that exists, so it goes in the schema as a
partial unique index rather than in a service check that a concurrent request can
race past. Names get no such index — namesakes are real.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Ключ идемпотентности на занесении заявки

**Files:**
- Create: `backend/app/models/idempotency.py`
- Create: `backend/app/core/idempotency.py`
- Modify: `backend/app/modules/tournaments/routers/intake.py`
- Test: `backend/tests/test_double_entry_guards.py` (дописать)

**Interfaces:**
- Consumes: таблица `idempotency_keys` из миграции задачи 1.
- Produces:
  - `IdempotencyKey` — модель с полями `key: str`, `endpoint: str`,
    `response: dict | None`, `created_at: datetime`.
  - `async def remembered_response(session, key, endpoint) -> dict | None` —
    возвращает ответ прежнего запроса или `None`, заняв ключ.
  - `async def remember_response(session, key, endpoint, response: dict) -> None`.

- [ ] **Step 1: Написать падающий тест**

Дописать в `backend/tests/test_double_entry_guards.py`:

```python
def test_the_same_commit_sent_twice_enters_people_once():
    """Двойной клик по «Завести» — не второй заход, а тот же самый."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    payload = sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])
    report = preview(client, tournament_id, payload, headers).json()

    key = {"Idempotency-Key": "11111111-1111-1111-1111-111111111111", **headers}
    first = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=key,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=key,
    )
    assert second.status_code == 200, second.text
    assert second.json() == first.json(), "повтор обязан вернуть прежний ответ"

    assert len(participants(client, tournament_id)) == 1


def test_a_commit_without_a_key_still_works():
    """Ключ необязателен: старый клиент не должен сломаться."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    payload = sheet_of([{"full_name": "Пётр Петров", "category": "Абсолютная мужская"}])
    report = preview(client, tournament_id, payload, headers).json()

    committed = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
        headers=headers,
    )
    assert committed.status_code == 200, committed.text
    assert len(participants(client, tournament_id)) == 1
```

Хелперы `sheet_of`, `preview`, `participants` скопировать из
`backend/tests/test_participant_import_api.py` — они там определены и не
импортируются между файлами тестов в этом проекте.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_double_entry_guards.py -q -p no:warnings -k "sent_twice or without_a_key"`

Expected: `test_the_same_commit_sent_twice_enters_people_once` FAIL — второй
запрос вернёт 400 (все строки уже заявлены), а не прежний ответ. Второй тест
проходит сразу и сторожит совместимость.

- [ ] **Step 3: Модель ключа**

Создать `backend/app/models/idempotency.py`:

```python
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
```

- [ ] **Step 4: Занятие ключа**

Создать `backend/app/core/idempotency.py`:

```python
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
```

- [ ] **Step 5: Подключить к коммиту**

В `backend/app/modules/tournaments/routers/intake.py` добавить импорты:

```python
from fastapi import Header
from app.core.idempotency import remember_response, remembered_response
```

и переписать тело `commit_import` — сигнатура получает заголовок, работа
обрамляется ключом:

```python
async def commit_import(
    tournament_id: str,
    payload: ImportCommitRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> ImportCommitResponse:
    tournament = await TournamentReadService.get_tournament(session, tournament_id)
    await ensure_can_manage_tournament(session, manager, tournament)

    endpoint = f"POST /tournaments/{tournament_id}/participants/import/commit"
    remembered = await remembered_response(session, idempotency_key, endpoint)
    if remembered is not None:
        # Тот же самый запрос, а не второй заход: никто не заводится повторно.
        await session.commit()
        return ImportCommitResponse(**remembered)

    result = await ParticipantImportService.commit(
        session,
        tournament,
        [row.model_dump() for row in payload.rows],
        actor_id=manager.user.id,
    )
    await remember_response(session, idempotency_key, endpoint, result)
    await session.commit()
    return ImportCommitResponse(**result)
```

Докстринг у функции оставить прежний, дописав к нему абзац:

```
    Повтор с тем же ``Idempotency-Key`` не заносит никого второй раз, а
    возвращает ответ первого запроса. Ключ занимается до работы, поэтому
    одновременный второй запрос упирается в первичный ключ таблицы, а не
    успевает пройти ту же проверку на ещё пустой базе.
```

- [ ] **Step 6: Прогнать тесты задачи**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_double_entry_guards.py -q -p no:warnings`

Expected: PASS, все четыре.

- [ ] **Step 7: Прогнать всю сюиту**

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`

Expected: 238 passed (234 прежних + 4 новых).

Отдельно проверьте, что `ImportCommitResponse(**remembered)` действительно
собирается из сохранённого JSON: `per_competition` — словарь, и после хождения
через JSON он остаётся словарём, а вот UUID-ы там уже строки. `commit` и так
возвращает строки (`str(tournament.id)`), но если сюита покажет иначе —
чините сериализацию, а не тест.

- [ ] **Step 8: Коммит**

```bash
git add backend/app/models/idempotency.py backend/app/core/idempotency.py \
        backend/app/modules/tournaments/routers/intake.py \
        backend/tests/test_double_entry_guards.py
git commit -m "feat(intake): a repeated commit returns the first answer instead of entering people twice

The dangerous version of a double click is the silent one: two requests in
flight can both pass validation before either writes. So the key is claimed
before the work rather than after it — the second request then meets a primary
key instead of an empty table.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Клиент шлёт ключ

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/api/tournaments.ts`
- Modify: `frontend/src/features/tournaments/participant-import-review.tsx`

**Interfaces:**
- Consumes: заголовок `Idempotency-Key` из задачи 2.
- Produces: `commitParticipantImport(tournamentId, rows, idempotencyKey)`.

- [ ] **Step 1: Разрешить заголовки в `apiRequest`**

В `frontend/src/lib/api.ts` найти тип `RequestOptions` и добавить в него поле:

```ts
  /**
   * Extra headers for this one request — an idempotency key, say. Applied
   * after the defaults so a caller can override `Accept`, and before the
   * bearer token, which the caller has no business replacing.
   */
  headers?: Record<string, string>;
```

Затем в самой функции (`frontend/src/lib/api.ts:55-61`) заменить две строки —
деструктуризацию и сборку заголовков:

```ts
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, revalidate = false, signal, headers: extra } = options;
  const authToken = token !== undefined ? token : readBrowserToken();

  const headers: Record<string, string> = { Accept: "application/json", ...(extra ?? {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
```

Остальное тело функции не трогать.

- [ ] **Step 2: Протащить ключ через api-обёртку**

В `frontend/src/api/tournaments.ts`:

```ts
/**
 * Enter the reviewed rows.
 *
 * The idempotency key is generated once per review session, so a double click
 * — or a retry after a dropped connection — returns the first answer instead of
 * entering everyone a second time.
 */
export const commitParticipantImport = (
  tournamentId: string,
  rows: ImportRow[],
  idempotencyKey: string,
) =>
  apiRequest<ImportCommitResponse>(
    `/api/v1/tournaments/${tournamentId}/participants/import/commit`,
    { method: "POST", body: { rows }, headers: { "Idempotency-Key": idempotencyKey } },
  );
```

- [ ] **Step 3: Ключ на сеанс просмотра**

В `frontend/src/features/tournaments/participant-import-review.tsx`, рядом с
остальным состоянием:

```tsx
  // Один ключ на сеанс просмотра: пока организатор правит строки, это тот же
  // самый заход, сколько бы раз он ни нажал «Завести». Новый отчёт — новый
  // компонент и новый ключ.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
```

и в `commit()`:

```tsx
      const result = await commitParticipantImport(report.tournament_id, included, idempotencyKey);
```

- [ ] **Step 4: Проверить фронт**

Run: `cd frontend && npx tsc --noEmit`
Expected: пусто.

Run: `cd frontend && npm run lint`
Expected: пусто.

Run: `cd frontend && npm run build`
Expected: exit 0.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/lib/api.ts frontend/src/api/tournaments.ts \
        frontend/src/features/tournaments/participant-import-review.tsx
git commit -m "feat(intake): the review session carries one key, so a second click is the same request

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Что этот план сознательно не делает

Не трогает хранилище файлов, повтор в заявках по хешу, выгрузку и архив — это
следующие планы по тому же спеку. Не чистит просроченные ключи: записи старше
суток удаляет отдельная задача вместе с первой появившейся фоновой уборкой, а
до тех пор таблица растёт на одну строку за загрузку заявки, что при десятках
турниров в год не проблема, которую стоит решать кодом сегодня.
