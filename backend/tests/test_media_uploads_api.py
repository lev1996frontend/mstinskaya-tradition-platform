"""Первые байты, которые бэкенд действительно хранит на диске.

До этой задачи `media_files` описывал только ссылки наружу. Здесь появляется
приём (`POST /api/v1/media/uploads`) и отдача (`GET /api/v1/media/files/{id}/download`)
настоящих файлов: формат распознаётся по содержимому, а не по имени, повтор тех
же байт не заводит вторую строку и второй объект на диске, а скачивание не
требует входа, хотя загрузка — требует.
"""

import asyncio
from io import BytesIO
from urllib.parse import quote

from docx import Document
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base
from tests.auth_test_helpers import snapshot_session, use_session

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def xlsx_bytes() -> bytes:
    stream = BytesIO()
    Workbook().save(stream)
    return stream.getvalue()


def docx_bytes() -> bytes:
    stream = BytesIO()
    Document().save(stream)
    return stream.getvalue()


def setup_app_for_tests():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def setup_db() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())

    def override_get_db():
        async def _override():
            async with database_module.AsyncSessionLocal() as session:
                yield session

        return _override

    app.dependency_overrides[database_module.get_db] = override_get_db()
    return TestClient(app)


def register(client, email: str) -> tuple[str, dict[str, str]]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор", "privacy_consent": True},
    )
    assert response.status_code == 201, response.text
    session = snapshot_session(client)
    me = client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    return me.json()["id"], session


def use_temp_storage(tmp_path):
    """Настоящее дисковое хранилище во временном каталоге, не заглушка."""
    from app.core import storage as storage_module

    app.dependency_overrides[storage_module.get_storage] = lambda: (
        storage_module.LocalDiskStorage(tmp_path)
    )


def test_a_word_document_is_accepted_and_comes_back_byte_for_byte(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")

    payload = docx_bytes()
    use_session(client, session)
    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", payload, DOCX)},
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["original_name"] == "положение.docx"
    assert body["size"] == len(payload)
    assert body["duplicate_of"] is None

    downloaded = client.get(f"/api/v1/media/files/{body['id']}/download")
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == payload
    # HTTP headers are latin-1: the Cyrillic name itself cannot appear literally,
    # only its RFC 5987 percent-encoded form (`filename*=UTF-8''...`).
    assert quote("положение.docx") in downloaded.headers["content-disposition"]


def test_downloading_needs_no_login(tmp_path):
    """Положение раздают тренерам, а тренер не залогинен."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")
    use_session(client, session)
    body = client.post(
        "/api/v1/media/uploads",
        files={"file": ("регламент.docx", docx_bytes(), DOCX)},
    ).json()

    assert client.get(f"/api/v1/media/files/{body['id']}/download").status_code == 200


def test_a_pdf_is_refused_by_name_not_by_shrug(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")

    use_session(client, session)
    refused = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.pdf", b"%PDF-1.7\n", "application/pdf")},
    )
    assert refused.status_code == 400, refused.text
    assert "pdf" in refused.json()["detail"].lower()


def test_an_executable_renamed_to_docx_is_refused(tmp_path):
    """Расширение — заявление отправителя, а не факт."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")

    use_session(client, session)
    refused = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", b"MZ\x90\x00 not a document", DOCX)},
    )
    assert refused.status_code == 400, refused.text


def test_the_same_bytes_twice_do_not_make_a_second_file(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")
    payload = docx_bytes()

    use_session(client, session)
    first = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", payload, DOCX)},
    ).json()
    use_session(client, session)
    second = client.post(
        "/api/v1/media/uploads",
        files={"file": ("оно-же.docx", payload, DOCX)},
    ).json()

    assert second["duplicate_of"] == first["id"]
    assert second["id"] == first["id"], "вторая строка media_files не заводится"
    assert len(list(tmp_path.rglob("*.docx"))) == 1, "второй объект на диск не пишется"


def test_an_oversized_upload_is_refused_and_nothing_lands_in_storage(tmp_path, monkeypatch):
    """A payload over the ceiling gets 413 and never reaches disk.

    The real ceiling is 20 MB; materialising that just to exercise the check
    would make this test slow for no reason, so the ceiling itself is turned
    down for the duration of the test instead.
    """
    from app.modules.media import uploads as uploads_module

    monkeypatch.setattr(uploads_module, "MAX_UPLOAD_BYTES", 10)

    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")

    use_session(client, session)
    refused = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", b"x" * 100, DOCX)},
    )
    assert refused.status_code == 413, refused.text
    assert list(tmp_path.rglob("*")) == [], "ничего не должно попасть на диск"


def test_an_oversized_upload_without_a_declared_length_is_refused_by_the_chunk_loop(tmp_path, monkeypatch):
    """The early Content-Length check is one guard; this exercises the other.

    The existing oversized-upload test declares an accurate, oversized
    Content-Length, which trips the check that runs BEFORE the chunk-reading
    loop — the loop itself never runs. This test sends the body through a
    generator instead of a fixed `bytes` payload, which makes httpx fall back
    to a body with no Content-Length header at all (verified: FastAPI's
    `Header(default=None)` sees `None` for a generator body), so the early
    check cannot fire and only the accumulation loop can refuse the request.
    """
    from app.modules.media import uploads as uploads_module

    monkeypatch.setattr(uploads_module, "MAX_UPLOAD_BYTES", 10)

    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    _, session = register(client, "organizer@example.com")

    boundary = "xxxxxxxxxxxxxxxxxxxxboundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="положение.docx"\r\n'
        f"Content-Type: {DOCX}\r\n\r\n"
    ).encode("utf-8") + (b"x" * 100) + f"\r\n--{boundary}--\r\n".encode("utf-8")

    def body_generator():
        yield body

    use_session(client, session)
    refused = client.post(
        "/api/v1/media/uploads",
        content=body_generator(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    assert refused.status_code == 413, refused.text
    assert list(tmp_path.rglob("*")) == [], "ничего не должно попасть на диск"


def test_uploading_requires_a_login(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    anonymous = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
    )
    assert anonymous.status_code == 401, anonymous.text


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
