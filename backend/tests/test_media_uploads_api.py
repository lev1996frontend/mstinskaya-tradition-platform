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
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор"},
    )
    assert response.status_code == 201, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"], headers


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
    # HTTP headers are latin-1: the Cyrillic name itself cannot appear literally,
    # only its RFC 5987 percent-encoded form (`filename*=UTF-8''...`).
    assert quote("положение.docx") in downloaded.headers["content-disposition"]


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
