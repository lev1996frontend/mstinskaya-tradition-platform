# Хранилище файлов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Положение, регламент и файл правил можно загрузить в платформу и
скачать обратно; сегодня их некуда положить.

**Architecture:** Шов 2 из трёх. Байты кладутся на диск через двухметодный
интерфейс `Storage`, метаданные живут в уже существующей таблице `media_files`,
а домены ссылаются на неё. Отдача идёт маршрутом приложения, а не раздачей
статики, чтобы переезд в S3 не сломал ни одной сохранённой ссылки. Приём и
хранение не знают друг о друге: хранилище никогда не разбирает содержимое, а
разбор заявок никогда ничего не сохраняет.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, pytest + TestClient на
`sqlite+aiosqlite`, Next.js App Router.

**Spec:** `docs/superpowers/specs/2026-09-07-files-architecture.md`, шов 2.

## Global Constraints

- **Форматы: только Excel и Word.** PDF **не принимается** — ни как документ
  турнира, ни как файл правил. Распознавание PDF остаётся, чтобы отказ звучал
  «PDF мы не принимаем, пришлите Word», а не «файл не прочитался».
- **Файл правил — только `.docx`.** `.xlsx` для правил отбивается.
- Потолок 20 МБ на файл, проверяется **при чтении потоком**, а не после того,
  как файл целиком оказался в памяти.
- Тип определяется **по содержимому**, никогда по расширению.
- **Скачивание публично** — вход не требуется, как у бланка заявки.
- **Загрузка требует прав**; `POST /api/v1/media/files` сегодня пускает кого
  угодно, и это закрывается здесь же.
- **Удаление — это снятие со страницы**: `removed_at` на связи, байты остаются.
- **Одинаковые байты не удваиваются**: хеш содержимого, вторая строка
  `media_files` не заводится.
- Комментарии объясняют ПОЧЕМУ, не что; по-английски. Русский — только в
  строках, которые видит пользователь (`detail`, подписи в интерфейсе).
- Тесты пишутся первыми и должны быть увидены падающими.
- **Хелперы между файлами тестов не импортируются** — в этом проекте каждый
  файл держит свою шапку. `use_temp_storage`, `docx_bytes`, `xlsx_bytes`,
  `register`, `bootstrap` копируются в каждый новый файл тестов целиком. Это не
  недосмотр, а сложившийся уклад: общего `conftest.py` здесь нет, и заводить
  его в этой работе не надо.
- Прогон бэкенда: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`.
  Сейчас 243 проходящих. Фронт: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Голова миграций: `20260907_double_entry_guards`.
- **После этой ветки образ бэкенда придётся пересобрать, если добавится
  зависимость.** Новых зависимостей здесь не предвидится — всё пишется на
  стандартной библиотеке.

## File Structure

| Файл | Ответственность |
| --- | --- |
| `backend/app/core/file_format.py` | опознание формата по содержимому; единственное общее место у трёх швов |
| `backend/app/core/storage.py` | интерфейс `Storage` и `LocalDiskStorage` |
| `backend/app/core/config.py` | + настройка `upload_dir` |
| `backend/app/modules/media/uploads.py` | приём и отдача: маршруты, лимиты, хеш |
| `backend/app/modules/media/models/media_file.py` | + `content_sha256` |
| `backend/app/modules/tournaments/models/tournament_document.py` | + `media_file_id`, `removed_at` |
| `backend/app/modules/rules/models/rule_set_document.py` | новая связь редакции правил с файлом |
| `backend/migrations/versions/20260908_file_storage.py` | одна ревизия на всё перечисленное |
| `backend/tests/test_media_uploads_api.py` | приём, отдача, лимиты, права, повтор |
| `frontend/src/features/documents/document-upload.tsx` | загрузка и снятие, общая для турнира и правил |

---

### Task 1: Опознание формата переезжает в ядро

**Files:**
- Create: `backend/app/core/file_format.py`
- Modify: `backend/app/modules/tournaments/services/intake/__init__.py`
- Test: `backend/tests/test_file_format.py`

**Interfaces:**
- Produces: `sniff(payload: bytes) -> str | None`, возвращающая один из
  `"xlsx"`, `"docx"`, `"pdf"`, `"doc"` или `None`.

- [ ] **Step 1: Написать падающий тест**

Создать `backend/tests/test_file_format.py`:

```python
"""Опознание формата по содержимому, а не по имени файла.

Имя врёт: тренер переименовывает документ в .xlsx, почтовый клиент режет
расширение, Word сохраняет .doc под именем .docx. Внутрь файла заглянуть
дешевле, чем разбираться потом.
"""

from io import BytesIO

from docx import Document
from openpyxl import Workbook

from app.core.file_format import sniff


def xlsx_bytes() -> bytes:
    stream = BytesIO()
    Workbook().save(stream)
    return stream.getvalue()


def docx_bytes() -> bytes:
    stream = BytesIO()
    Document().save(stream)
    return stream.getvalue()


def test_a_spreadsheet_is_recognised_whatever_it_is_called():
    assert sniff(xlsx_bytes()) == "xlsx"


def test_a_word_document_is_recognised_whatever_it_is_called():
    assert sniff(docx_bytes()) == "docx"


def test_a_pdf_is_recognised_so_the_refusal_can_name_it():
    """PDF никуда не принимается, но «не прочиталось» — плохой ответ."""
    assert sniff(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n") == "pdf"


def test_the_old_binary_word_format_is_recognised_too():
    assert sniff(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1 old word") == "doc"


def test_anything_else_is_unknown():
    assert sniff(b"just some text") is None
    assert sniff(b"") is None
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_file_format.py -q -p no:warnings`
Expected: ошибка импорта `app.core.file_format` — модуля ещё нет.

- [ ] **Step 3: Написать модуль**

Создать `backend/app/core/file_format.py`:

```python
"""What a file actually is, decided by looking inside it.

The one thing all three file seams share. Intake asks it to pick a parser,
storage asks it to accept or refuse an upload, and both ask for the same
reason: a file name is a claim by whoever sent the file, and it is wrong often
enough to matter — a renamed document, a mail client that dropped the
extension, a Word file saved under the other Word extension.

PDF is recognized even though nothing in the platform accepts it. Knowing it is
a PDF is what lets the refusal say «PDF мы не принимаем, пришлите Word»
instead of «файл не прочитался», which sends the sender to fix the wrong thing.
"""

from __future__ import annotations

import zipfile
from io import BytesIO

#: Both modern Office formats are zip archives; what is inside says which.
EXCEL_MEMBER = "xl/workbook.xml"
WORD_MEMBER = "word/document.xml"

PDF_MAGIC = b"%PDF-"
#: The OLE compound-file header the pre-2007 Office formats start with.
OLE_MAGIC = b"\xd0\xcf\x11\xe0"


def sniff(payload: bytes) -> str | None:
    """``"xlsx"``, ``"docx"``, ``"pdf"``, ``"doc"`` — or ``None`` if unknown."""
    if not payload:
        return None
    if payload.startswith(PDF_MAGIC):
        return "pdf"
    if payload.startswith(OLE_MAGIC):
        return "doc"
    try:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            names = set(archive.namelist())
    except zipfile.BadZipFile:
        return None
    if WORD_MEMBER in names:
        return "docx"
    if EXCEL_MEMBER in names:
        return "xlsx"
    return None
```

- [ ] **Step 4: Прогнать тест**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_file_format.py -q -p no:warnings`
Expected: 5 passed.

- [ ] **Step 5: Переключить разбор заявок на общий модуль**

В `backend/app/modules/tournaments/services/intake/__init__.py` удалить
константы `EXCEL_MEMBER`, `WORD_MEMBER` и локальное определение формата внутри
`parse_entry_file`, заменив их вызовом `sniff`:

```python
from app.core.file_format import sniff
```

```python
    kind = sniff(payload)
    if kind == "docx":
        return parse_document(stream)
    if kind == "xlsx":
        return parse_workbook(stream)
```

Остальное тело `parse_entry_file` (отказ для `.doc`/`.rtf`/`.odt` по расширению
и падение назад на разбор таблицы) не трогать: оно про сообщения об ошибках, а
не про опознание.

- [ ] **Step 6: Прогнать всю сюиту**

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`
Expected: 248 passed (243 + 5 новых). Ни один тест импорта заявок падать не
должен — это чистый переезд.

- [ ] **Step 7: Коммит**

```bash
git add backend/app/core/file_format.py backend/tests/test_file_format.py \
        backend/app/modules/tournaments/services/intake/__init__.py
git commit -m "refactor(core): what a file is gets decided in one place

Storage is about to ask the same question intake already asks, and for the same
reason: a file name is a claim by whoever sent the file. Two copies of that
judgement would disagree within a release.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Интерфейс хранилища и диск

**Files:**
- Create: `backend/app/core/storage.py`
- Modify: `backend/app/core/config.py`
- Test: `backend/tests/test_storage.py`

**Interfaces:**
- Produces: `Storage` (Protocol) с `put(key, data) -> None` и `open(key) -> BinaryIO`;
  `LocalDiskStorage(root: Path)`; `get_storage() -> Storage` для внедрения зависимости;
  настройка `settings.upload_dir` со значением по умолчанию `./var/uploads`.

- [ ] **Step 1: Написать падающий тест**

Создать `backend/tests/test_storage.py`:

```python
"""Байты кладутся на диск и читаются обратно — на настоящем диске.

Заглушка здесь бесполезна: проверять надо именно то, что файл появился и
прочёлся, а это ровно то, чего заглушка не делает.
"""

from io import BytesIO

import pytest

from app.core.storage import LocalDiskStorage


def test_bytes_written_are_the_bytes_read_back(tmp_path):
    storage = LocalDiskStorage(tmp_path)
    storage.put("media/abc.docx", BytesIO(b"hello \xd0\xbc\xd1\x81\xd1\x82\xd0\xb0"))

    with storage.open("media/abc.docx") as stream:
        assert stream.read() == b"hello \xd0\xbc\xd1\x81\xd1\x82\xd0\xb0"


def test_a_key_cannot_escape_the_root(tmp_path):
    """«../» в ключе — это попытка писать мимо хранилища, а не ключ."""
    storage = LocalDiskStorage(tmp_path)
    with pytest.raises(ValueError):
        storage.put("../outside.docx", BytesIO(b"x"))
    with pytest.raises(ValueError):
        storage.open("../../etc/passwd")


def test_reading_a_missing_key_says_so(tmp_path):
    storage = LocalDiskStorage(tmp_path)
    with pytest.raises(FileNotFoundError):
        storage.open("media/nothing.docx")
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_storage.py -q -p no:warnings`
Expected: ошибка импорта `app.core.storage`.

- [ ] **Step 3: Написать хранилище**

Создать `backend/app/core/storage.py`:

```python
"""Where the bytes live.

Two methods, one implementation. The interface exists so the day this moves to
S3 is a day that touches this file and nothing else — `docs/architecture.md`
names object storage as the destination, and the only reason it is a local
directory today is that there is one instance and no cloud bill.

There is no `delete`. Files are never erased in this platform: removing a
document means marking the link removed, and the bytes stay because something
may still cite them. A method that does not exist cannot be called by mistake.
"""

from __future__ import annotations

from pathlib import Path
from typing import BinaryIO, Protocol


class Storage(Protocol):
    def put(self, key: str, data: BinaryIO) -> None: ...

    def open(self, key: str) -> BinaryIO: ...


class LocalDiskStorage:
    """Files under one root directory.

    Synchronous on purpose: a 20 MB write finishes faster than the hop to a
    thread pool costs, and `aiofiles` would buy nothing. A network-backed
    implementation would make the interface async, and that is one edit here.
    """

    def __init__(self, root: Path | str) -> None:
        self._root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        # Keys are minted by us, but treating them as untrusted costs one line
        # and removes a whole class of "how did that file get written there".
        candidate = (self._root / key).resolve()
        if not candidate.is_relative_to(self._root):
            raise ValueError(f"storage key escapes the root: {key!r}")
        return candidate

    def put(self, key: str, data: BinaryIO) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as target:
            while chunk := data.read(1024 * 1024):
                target.write(chunk)

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")
```

- [ ] **Step 4: Добавить настройку и внедрение**

В `backend/app/core/config.py`, в класс `Settings`, рядом с `cors_origins`:

```python
    #: Where uploaded documents are kept. A directory rather than a bucket for
    #: now; see docs/superpowers/specs/2026-09-07-files-architecture.md.
    upload_dir: str = "./var/uploads"
```

В конец `backend/app/core/storage.py`:

```python
from functools import lru_cache

from app.core.config import get_settings


@lru_cache
def get_storage() -> Storage:
    """The one storage the app writes to, resolved from settings."""
    return LocalDiskStorage(get_settings().upload_dir)
```

- [ ] **Step 5: Прогнать тесты**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_storage.py -q -p no:warnings`
Expected: 3 passed.

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`
Expected: 251 passed.

- [ ] **Step 6: Коммит**

```bash
git add backend/app/core/storage.py backend/app/core/config.py backend/tests/test_storage.py
git commit -m "feat(core): a place to put bytes, behind two methods

The interface is the whole point: architecture.md names S3 as the destination
and the only reason this is a directory is that there is one instance today.
No delete method — files are never erased here, and a method that does not
exist cannot be called by mistake.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Приём и отдача файла

**Files:**
- Create: `backend/app/modules/media/uploads.py`
- Modify: `backend/app/modules/media/models/media_file.py`, `backend/app/main.py`
- Create: `backend/migrations/versions/20260908_file_storage.py`
- Test: `backend/tests/test_media_uploads_api.py`

**Interfaces:**
- Produces: `POST /api/v1/media/uploads` (multipart, поле `file`) → `{id, url,
  original_name, size, mime_type, duplicate_of}`; `GET /api/v1/media/files/{id}/download`;
  колонка `media_files.content_sha256` с индексом.
- Consumes: `sniff` из задачи 1, `get_storage` из задачи 2.

- [ ] **Step 1: Написать падающие тесты**

Создать `backend/tests/test_media_uploads_api.py`. Шапку (`setup_app_for_tests`,
`register`) скопировать из `backend/tests/test_double_entry_guards.py`. Добавить
переопределение хранилища на временный каталог — оно и есть настоящая проверка,
что байты легли:

```python
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def use_temp_storage(tmp_path):
    """Настоящее дисковое хранилище во временном каталоге, не заглушка."""
    from app.core import storage as storage_module

    app.dependency_overrides[storage_module.get_storage] = lambda: (
        storage_module.LocalDiskStorage(tmp_path)
    )


def test_a_word_document_is_accepted_and_comes_back_byte_for_byte(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "organizer@example.com")

    payload = docx_bytes()
    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", payload, DOCX)},
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["original_name"] == "положение.docx"
    assert body["size"] == len(payload)
    assert body["duplicate_of"] is None

    downloaded = client.get(f"/api/v1/media/files/{body['id']}/download")
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == payload
    assert "положение.docx" in downloaded.headers["content-disposition"]


def test_downloading_needs_no_login(tmp_path):
    """Положение раздают тренерам, а тренер не залогинен."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "organizer@example.com")
    body = client.post(
        "/api/v1/media/uploads",
        files={"file": ("регламент.docx", docx_bytes(), DOCX)},
        headers=headers,
    ).json()

    assert client.get(f"/api/v1/media/files/{body['id']}/download").status_code == 200


def test_a_pdf_is_refused_by_name_not_by_shrug(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "organizer@example.com")

    refused = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.pdf", b"%PDF-1.7\n", "application/pdf")},
        headers=headers,
    )
    assert refused.status_code == 400, refused.text
    assert "pdf" in refused.json()["detail"].lower()


def test_an_executable_renamed_to_docx_is_refused(tmp_path):
    """Расширение — заявление отправителя, а не факт."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "organizer@example.com")

    refused = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", b"MZ\x90\x00 not a document", DOCX)},
        headers=headers,
    )
    assert refused.status_code == 400, refused.text


def test_the_same_bytes_twice_do_not_make_a_second_file(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "organizer@example.com")
    payload = docx_bytes()

    first = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", payload, DOCX)},
        headers=headers,
    ).json()
    second = client.post(
        "/api/v1/media/uploads",
        files={"file": ("оно-же.docx", payload, DOCX)},
        headers=headers,
    ).json()

    assert second["duplicate_of"] == first["id"]
    assert second["id"] == first["id"], "вторая строка media_files не заводится"
    assert len(list(tmp_path.rglob("*.docx"))) == 1, "второй объект на диск не пишется"


def test_uploading_requires_a_login(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    anonymous = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
    )
    assert anonymous.status_code == 401, anonymous.text
```

`docx_bytes()` и `xlsx_bytes()` скопировать из `backend/tests/test_file_format.py`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_media_uploads_api.py -q -p no:warnings`
Expected: все падают 404 — маршрутов нет.

- [ ] **Step 3: Добавить колонку хеша на модель**

В `backend/app/modules/media/models/media_file.py`, рядом со `storage_key`:

```python
    #: SHA-256 of the stored bytes, so the same file sent twice — a coach
    #: resending «на всякий случай», a mail server delivering twice — reuses the
    #: one stored object instead of quietly doubling it. Indexed because every
    #: upload looks itself up here before writing anything.
    content_sha256: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
```

Nullable: строки, заведённые до этой работы, хеша не имеют и не обязаны.

- [ ] **Step 4: Написать маршруты**

Создать `backend/app/modules/media/uploads.py` — приём и отдача одним модулем,
потому что это две стороны одного дела:

```python
"""Files in, files out.

Separate from `router.py`, which records metadata about files that live
somewhere else entirely. This module is the only place in the backend that
writes bytes to disk.

Uploading needs a login; downloading does not. That asymmetry is deliberate and
the same one the entry-list blank already has: the coach who reads a положение
is usually not the organizer and usually not signed in, while putting a file
into the platform is not something an anonymous caller does.
"""

from __future__ import annotations

import hashlib
from io import BytesIO
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.file_format import sniff
from app.core.storage import Storage, get_storage
from app.modules.identity.models import User
from app.modules.identity.security.depends import get_current_user
from app.modules.media.models.media_file import MediaFile

router = APIRouter(prefix="/api/v1/media", tags=["media-uploads"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024

#: What the platform stores, and what each kind is called on the way back out.
ACCEPTED = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

REFUSALS = {
    "pdf": "PDF мы не принимаем — пришлите файл в Word или Excel.",
    "doc": "Старый .doc не поддерживается — пересохраните как «Документ Word (.docx)».",
}


@router.post("/uploads", status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> dict:
    """Take one document in.

    The format is decided by looking inside the file, never by its name, and
    the refusal names the format it found — «PDF мы не принимаем» sends the
    sender to fix the right thing, «не прочиталось» does not.
    """
    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ.",
        )

    kind = sniff(payload)
    if kind in REFUSALS:
        raise HTTPException(status_code=400, detail=REFUSALS[kind])
    if kind not in ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail="Принимаются только файлы Word (.docx) и Excel (.xlsx).",
        )

    digest = hashlib.sha256(payload).hexdigest()
    existing = await session.scalar(
        select(MediaFile).where(MediaFile.content_sha256 == digest)
    )
    if existing is not None:
        # Same bytes: one stored object, one row, a new link wherever the
        # caller is attaching it. Writing a second copy would leave two rows
        # whose deletion semantics depend on each other.
        return _described(existing, duplicate_of=str(existing.id))

    name = file.filename or f"файл.{kind}"
    key = f"media/{uuid4()}.{kind}"
    storage.put(key, BytesIO(payload))

    stored = MediaFile(
        filename=key.rsplit("/", 1)[-1],
        original_name=name[:255],
        storage_key=key,
        url=f"/api/v1/media/files/placeholder/download",
        type="DOCUMENT",
        size=len(payload),
        mime_type=ACCEPTED[kind],
        content_sha256=digest,
        uploaded_by=current_user.id,
    )
    session.add(stored)
    await session.flush()
    # The public address needs the id, which only exists after the flush.
    stored.url = f"/api/v1/media/files/{stored.id}/download"
    await session.commit()
    return _described(stored, duplicate_of=None)


def _described(stored: MediaFile, *, duplicate_of: str | None) -> dict:
    return {
        "id": str(stored.id),
        "url": stored.url,
        "original_name": stored.original_name,
        "size": stored.size,
        "mime_type": stored.mime_type,
        "duplicate_of": duplicate_of,
    }


@router.get("/files/{media_file_id}/download")
async def download_file(
    media_file_id: str,
    session: AsyncSession = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> StreamingResponse:
    """Hand the file back under the name it arrived with.

    A route rather than a static mount: static serving sets no
    `Content-Disposition`, so Word would open as rubbish in the browser instead
    of downloading, and the URL would copy the layout on disk — which would make
    a move to S3 break every stored link. This route can answer with a redirect
    to a signed URL later and no saved address changes.

    Public, like the entry-list blank and for the same reason.
    """
    stored = await session.get(MediaFile, media_file_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Файл не найден.")
    try:
        stream = storage.open(stored.storage_key)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Файл числится в базе, но его нет в хранилище.",
        ) from None

    from urllib.parse import quote

    # RFC 5987: the name is Russian more often than not, and a bare
    # `filename=` would arrive mangled or truncated at the first non-ASCII byte.
    disposition = f"attachment; filename*=UTF-8''{quote(stored.original_name)}"
    return StreamingResponse(
        stream,
        media_type=stored.mime_type or "application/octet-stream",
        headers={"Content-Disposition": disposition},
    )
```

В `backend/app/main.py` рядом с остальными:

```python
from app.modules.media.uploads import router as media_uploads_router
```
```python
app.include_router(media_uploads_router)
```

- [ ] **Step 4б: Закрыть дыру в существующем медиа-роутере**

`POST /api/v1/media/files` в `backend/app/modules/media/router.py` сегодня
позволяет **кому угодно без входа** завести запись о файле. Пока файлов не
было, это была запись о ссылке наружу; теперь рядом появляется настоящее
хранилище, и оставлять открытую дверь нельзя.

Добавить туда ту же зависимость, что и на приёме:

```python
from app.modules.identity.models import User
from app.modules.identity.security.depends import get_current_user
```

```python
@router.post("/files", response_model=MediaFileRead, status_code=status.HTTP_201_CREATED)
async def create_media_file(
    payload: MediaFileCreate,
    service: Annotated[MediaService, Depends(get_media_service)],
    # Recording a file was open to anonymous callers for as long as this route
    # has existed. Nothing behind it was writable then; that stops being true
    # on the next line of this branch.
    current_user: User = Depends(get_current_user),
):
```

Тест туда же, в `backend/tests/test_media_uploads_api.py`:

```python
def test_recording_a_media_file_is_no_longer_open_to_anyone(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    anonymous = client.post(
        "/api/v1/media/files",
        json={
            "filename": "x.docx",
            "original_name": "x.docx",
            "storage_key": "media/x.docx",
            "url": "https://example.org/x.docx",
            "uploaded_by": "00000000-0000-0000-0000-000000000001",
        },
    )
    assert anonymous.status_code == 401, anonymous.text
```

Если этот маршрут уже используют существующие тесты — добавьте им заголовки, а
не снимайте проверку.

- [ ] **Step 5: Написать миграцию**

Создать `backend/migrations/versions/20260908_file_storage.py`:

```python
"""файлы наконец есть где хранить

Колонка хеша на media_files — чтобы те же байты, присланные дважды, не
удваивались: одна строка, один объект на диске, вторая ссылка. Nullable,
потому что строки, заведённые до появления хранилища, хеша не имеют и
задним числом его взять неоткуда — файлов у них нет.

Revision ID: 20260908_file_storage
Revises: 20260907_double_entry_guards
Create Date: 2026-09-08 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260908_file_storage"
down_revision = "20260907_double_entry_guards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_files", sa.Column("content_sha256", sa.String(length=64), nullable=True))
    op.create_index("ix_media_files_content_sha256", "media_files", ["content_sha256"])


def downgrade() -> None:
    op.drop_index("ix_media_files_content_sha256", table_name="media_files")
    op.drop_column("media_files", "content_sha256")
```

Задачи 4 и 5 дополнят **эту же** ревизию своими таблицами и колонками: она ещё
нигде не применена, а одна ревизия на один шов читается лучше трёх.

- [ ] **Step 6: Прогнать**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_media_uploads_api.py -q -p no:warnings`
Expected: 6 passed.

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`
Expected: 257 passed.

- [ ] **Step 7: Проверить на живом Postgres**

Докер на этой машине поднят. Проверять надо и вверх, и вниз:

```bash
docker exec mstina-backend alembic upgrade head
docker exec mstina-postgres psql -U mstina -d mstina -c "\d media_files"
docker exec mstina-backend alembic downgrade -1
docker exec mstina-backend alembic upgrade head
```

Expected: колонка и индекс появляются, снимаются и появляются снова.

**Если добавится хоть одна зависимость — образ придётся пересобрать**
(`docker compose build backend`): прошлый раз контейнер падал в цикле на
отсутствующем модуле, а тесты этого не видели, потому что бегут в venv на хосте.

- [ ] **Step 8: Коммит**

```bash
git add backend/app/modules/media/uploads.py backend/app/modules/media/models/media_file.py \
        backend/app/main.py backend/migrations/versions/20260908_file_storage.py \
        backend/tests/test_media_uploads_api.py
git commit -m "feat(media): a file can be handed in and handed back

The first bytes the backend has ever stored. Format decided by looking inside
the file, so a renamed executable is refused and a PDF is refused by name
rather than with a shrug. The same bytes twice reuse the one stored object.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Документы турнира ссылаются на файл

**Files:**
- Modify: `backend/app/modules/tournaments/models/tournament_document.py`,
  `backend/app/modules/tournaments/routers/tournaments.py`,
  `backend/app/modules/tournaments/schemas/tournament_document.py`,
  `backend/app/modules/tournaments/services/tournament_service.py`,
  `backend/migrations/versions/20260908_file_storage.py`
- Test: `backend/tests/test_tournament_documents_api.py`

**Interfaces:**
- Consumes: `POST /api/v1/media/uploads` из задачи 3.
- Produces: `media_file_id` и `removed_at` на `tournament_documents`;
  `DELETE /api/v1/tournaments/{id}/documents/{document_id}` — снятие со страницы.

- [ ] **Step 1: Написать падающие тесты**

Создать `backend/tests/test_tournament_documents_api.py` (шапку и `bootstrap`
скопировать из `test_participant_import_api.py`):

```python
def test_an_uploaded_file_becomes_a_tournament_document(tmp_path):
    """Загрузили файл, приложили к турниру, скачали по ссылке из списка."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, headers = bootstrap(client)

    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
        headers=headers,
    ).json()

    created = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение", "media_file_id": uploaded["id"], "type": "POSITION"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["file_url"] == uploaded["url"]

    listed = client.get(f"/api/v1/tournaments/{tournament_id}/documents").json()
    assert [d["title"] for d in listed] == ["Положение"]
    assert client.get(uploaded["url"]).status_code == 200


def test_an_external_link_still_works(tmp_path):
    """Старый способ — голая ссылка наружу — ломать нельзя."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, headers = bootstrap(client)

    created = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Регламент", "file_url": "https://example.org/reg.docx"},
        headers=headers,
    )
    assert created.status_code == 201, created.text


def test_a_document_neither_uploaded_nor_linked_is_refused(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, headers = bootstrap(client)

    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Ничто"},
        headers=headers,
    )
    assert refused.status_code == 422, refused.text


def test_removing_a_document_hides_it_but_keeps_the_file(tmp_path):
    """Снятие со страницы — не удаление: старое положение могли процитировать."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, headers = bootstrap(client)
    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
        headers=headers,
    ).json()
    document = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение", "media_file_id": uploaded["id"]},
        headers=headers,
    ).json()

    removed = client.delete(
        f"/api/v1/tournaments/{tournament_id}/documents/{document['id']}", headers=headers
    )
    assert removed.status_code == 204, removed.text
    assert client.get(f"/api/v1/tournaments/{tournament_id}/documents").json() == []
    assert client.get(uploaded["url"]).status_code == 200, "файл остаётся живым"


def test_attaching_a_document_requires_a_manager(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, headers = bootstrap(client)
    _, stranger = register(client, "stranger@example.com")

    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Чужое", "file_url": "https://example.org/x.docx"},
        headers=stranger,
    )
    assert refused.status_code == 403, refused.text
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_tournament_documents_api.py -q -p no:warnings`
Expected: падают — `media_file_id` схема не принимает, `DELETE` маршрута нет,
проверки прав нет.

- [ ] **Step 3: Модель и миграция**

В `backend/app/modules/tournaments/models/tournament_document.py` добавить:

```python
    #: Set when the document was uploaded here. Null when it is a link to
    #: somewhere else — those rows predate the storage and must keep working.
    media_file_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("media_files.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    #: Taken off the page, not deleted. The bytes and the link stay alive
    #: because an old положение may have been cited somewhere.
    removed_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

В `backend/migrations/versions/20260908_file_storage.py`, в `upgrade()`:

```python
    op.add_column(
        "tournament_documents",
        sa.Column("media_file_id", sa.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tournament_documents_media_file_id",
        "tournament_documents",
        "media_files",
        ["media_file_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_tournament_documents_media_file_id", "tournament_documents", ["media_file_id"]
    )
    op.add_column(
        "tournament_documents",
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
    )
```

и зеркально в `downgrade()`, в обратном порядке.

- [ ] **Step 4: Схема, сервис, маршруты**

`TournamentDocumentCreateRequest`: `file_url` становится необязательным,
появляется `media_file_id`, и добавляется проверка «одно из двух обязательно»:

```python
class TournamentDocumentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=2, max_length=200)
    #: Either an uploaded file or a link to somewhere else — never neither. A
    #: document row with no address is a title that points at nothing.
    media_file_id: str | None = None
    file_url: str | None = Field(default=None, max_length=500)
    type: DocumentType = "RULES"

    @model_validator(mode="after")
    def _needs_an_address(self) -> "TournamentDocumentCreateRequest":
        if not self.media_file_id and not self.file_url:
            raise ValueError("Нужен либо загруженный файл, либо ссылка.")
        return self
```

(добавить `from pydantic import model_validator`).

В `create_document` роутера `tournaments.py` добавить проверку прав тем же
`ensure_can_manage_tournament`, что и у заявок, и подстановку `file_url` из
загруженного файла. Рядом — снятие со страницы:

```python
@router.delete("/{tournament_id}/documents/{document_id}", status_code=204)
async def remove_document(
    tournament_id: str,
    document_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Take the document off the page. The file itself stays.

    Not a delete: an old положение may have been cited or handed out, and a
    link that stops answering is worse than a page that no longer lists it.
    """
```

`list_documents` в сервисе получает `.where(TournamentDocument.removed_at.is_(None))`.

- [ ] **Step 5: Прогнать**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_tournament_documents_api.py -q -p no:warnings`
Expected: 5 passed.

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`
Expected: 262 passed.

**Внимание:** добавление проверки прав в `create_document` может уронить
существующие тесты, которые заводили документы без токена. Если так — чините
тесты (добавляйте заголовки), а не снимайте проверку: маршрут без прав и есть
та дыра, которую эта задача закрывает.

- [ ] **Step 6: Коммит**

```bash
git add backend/app/modules/tournaments backend/migrations/versions/20260908_file_storage.py \
        backend/tests/test_tournament_documents_api.py
git commit -m "feat(tournaments): a положение can be a file, not only a link

Uploaded documents point at our own storage; the old external links keep
working, so nothing that exists today breaks. Removing a document takes it off
the page and leaves the bytes, because an old положение may have been cited.
Attaching one now requires the same permission entering a fighter does — that
route had none at all.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Файл правил у редакции

**Files:**
- Create: `backend/app/modules/rules/models/rule_set_document.py`
- Modify: `backend/app/modules/rules/models/__init__.py`,
  `backend/app/modules/rules/routers/rules.py`,
  `backend/app/modules/rules/services/rule_service.py`,
  `backend/migrations/versions/20260908_file_storage.py`
- Test: `backend/tests/test_rule_documents_api.py`

**Interfaces:**
- Produces: таблица `rule_set_documents` (`id`, `rule_set_id`, `media_file_id`,
  `title`, `created_at`, `removed_at`); `POST /api/v1/rulesets/{id}/documents`,
  `GET /api/v1/rulesets/{id}/documents`, `DELETE /api/v1/rulesets/{id}/documents/{doc_id}`.

- [ ] **Step 1: Написать падающие тесты**

Ключевые проверки — их две, и вторая важнее:

```python
def test_only_word_is_accepted_for_rules(tmp_path):
    """Регламент правят и версионируют; таблица для этого не годится."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "admin@example.com")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    spreadsheet = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.xlsx", xlsx_bytes(), XLSX)},
        headers=headers,
    ).json()

    refused = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": spreadsheet["id"]},
        headers=headers,
    )
    assert refused.status_code == 400, refused.text
    assert "word" in refused.json()["detail"].lower()


def test_a_new_edition_does_not_take_the_old_editions_file(tmp_path):
    """История не переписывается: у старой редакции остаётся её файл."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "admin@example.com")

    first = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ARCHIVED"}
    ).json()
    document = client.post("/api/v1/media/uploads",
        files={"file": ("правила-1.docx", docx_bytes(), DOCX)}, headers=headers).json()
    client.post(
        f"/api/v1/rulesets/{first['id']}/documents",
        json={"title": "Редакция 1.0", "media_file_id": document["id"]},
        headers=headers,
    )

    second = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "2.0", "status": "ACTIVE"}
    ).json()

    assert len(client.get(f"/api/v1/rulesets/{first['id']}/documents").json()) == 1
    assert client.get(f"/api/v1/rulesets/{second['id']}/documents").json() == []
```

Ещё три теста в тот же файл, каждый со своим утверждением:

```python
def test_attaching_a_rules_file_requires_a_role(tmp_path):
    """У правил маршрутов с проверкой прав не было вовсе — заводим здесь."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, stranger = register(client, "stranger@example.com")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    document = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.docx", docx_bytes(), DOCX)},
        headers=stranger,
    ).json()

    refused = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": document["id"]},
        headers=stranger,
    )
    assert refused.status_code == 403, refused.text


def test_the_rules_file_downloads_without_a_login(tmp_path):
    """Правила читают все — это их назначение."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "admin@example.com")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    document = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.docx", docx_bytes(), DOCX)},
        headers=headers,
    ).json()
    client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": document["id"]},
        headers=headers,
    )

    assert client.get(document["url"]).status_code == 200


def test_removing_a_rules_file_hides_it_and_keeps_the_bytes(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, headers = register(client, "admin@example.com")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    document = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.docx", docx_bytes(), DOCX)},
        headers=headers,
    ).json()
    attached = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": document["id"]},
        headers=headers,
    ).json()

    removed = client.delete(
        f"/api/v1/rulesets/{ruleset['id']}/documents/{attached['id']}", headers=headers
    )
    assert removed.status_code == 204, removed.text
    assert client.get(f"/api/v1/rulesets/{ruleset['id']}/documents").json() == []
    assert client.get(document["url"]).status_code == 200
```

Роль исполнителю придётся выдать вручную: `register` заводит обычного
пользователя без ролей, а `INSTRUCTOR`/`ADMIN` присваиваются строками в
`roles`/`user_roles`. Как это делается, посмотрите в
`backend/tests/` — там уже есть тесты, дающие пользователю роль; если такого
хелпера нет, напишите его в этом файле и назовите `grant_role(client, session,
user_id, code)`. **Не** ослабляйте проверку прав ради простоты теста.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_rule_documents_api.py -q -p no:warnings`
Expected: 404 — маршрутов нет.

- [ ] **Step 3: Модель, миграция, маршруты**

Модель по образцу `TournamentDocument`, с докстрингом, объясняющим ПОЧЕМУ это
отдельная таблица, а не колонка на `RuleSet`:

```python
class RuleSetDocument(Base):
    """The Word file of one edition of the rules.

    A table rather than a column on `RuleSet` for two reasons: an edition has no
    file at all today, and editions are historical — `docs/architecture.md`
    forbids rewriting them, so the 1.0 file must survive the arrival of 2.0
    untouched.
    """
```

Проверка формата при привязке — по `mime_type` уже сохранённого файла:
принимается только `.docx`, `.xlsx` отбивается с текстом, называющим Word.

Права: `INSTRUCTOR`/`ADMIN` через тот же механизм ролей, что в
`app/modules/tournaments/security/deps.py` (`user_role_codes`). Заводить второй
механизм не надо — импортировать существующий.

- [ ] **Step 4: Прогнать и закоммитить**

Run: `cd backend && .venv/Scripts/python.exe -m pytest -q -p no:warnings`
Expected: 267 passed.

```bash
git commit -m "feat(rules): an edition of the rules can carry its own Word file

A table rather than a column, because editions are historical: the 1.0 file has
to survive the arrival of 2.0 untouched. Word only — a регламент is edited and
versioned, and a spreadsheet is not that.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Загрузка в интерфейсе

**Files:**
- Create: `frontend/src/features/documents/document-upload.tsx`
- Modify: `frontend/src/api/tournaments.ts`, `frontend/src/types/index.ts`,
  `frontend/src/app/tournaments/[id]/page.tsx`, `frontend/src/app/rules/[id]/page.tsx`
- Verify: `npx tsc --noEmit`, `npm run lint`, `npm run build`

- [ ] **Step 1: Типы и вызовы API**

`MediaUploadResponse` (`id`, `url`, `original_name`, `size`, `mime_type`,
`duplicate_of`), `uploadDocument(file)` через существующий `apiUpload`,
`attachTournamentDocument`, `removeTournamentDocument`.

- [ ] **Step 2: Компонент загрузки**

Клиентский компонент: выбор файла (`accept=".docx,.xlsx"`, для правил только
`.docx`), поле заголовка, выбор типа документа, кнопка. Две стадии — сначала
`uploadDocument`, потом привязка; если сервер вернул `duplicate_of`, показать
«этот файл уже загружен» и всё равно позволить приложить, потому что тот же
файл законно бывает нужен в двух местах.

Знаки форматов уже есть: `SheetMark` из `components/brand/sheet-marks.tsx` —
новую графику не рисовать.

- [ ] **Step 3: Встроить**

В разделе «Документы» страницы турнира — компонент под списком, видимый тому,
кто залогинен (`canManage = Boolean(user)`, настоящая проверка на сервере), и
крестик «снять» у каждой записи. На странице редакции правил — то же, но
только `.docx`.

- [ ] **Step 4: Проверить**

Run: `cd frontend && npx tsc --noEmit` — пусто.
Run: `cd frontend && npm run lint` — пусто.
Run: `cd frontend && npm run build` — exit 0.

- [ ] **Step 5: Коммит**

```bash
git commit -m "feat(documents): the положение gets uploaded from the page it belongs to

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Чего этот план сознательно не делает

Не строит выгрузку (шов 3) и не трогает архив прошедших турниров. Не разбирает
PDF и Word на текст. Не делает превью в браузере. Не убирает старые ключи
идемпотентности — этот долг записан в спеке и ждёт первой фоновой уборки.
