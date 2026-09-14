"""Файл правил у редакции.

A `RuleSet` is one historical edition of the rules; this adds the Word file it
was published as. A separate table rather than a column on `RuleSet`, because
an edition has no file at all today and because editions are historical
(`docs/architecture.md` forbids rewriting them) — the 1.0 file must survive
the arrival of 2.0 untouched.
"""

import asyncio
from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base
from tests.auth_test_helpers import snapshot_session

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


def use_temp_storage(tmp_path):
    """Настоящее дисковое хранилище во временном каталоге, не заглушка."""
    from app.core import storage as storage_module

    app.dependency_overrides[storage_module.get_storage] = lambda: (
        storage_module.LocalDiskStorage(tmp_path)
    )


def register(client, email: str) -> tuple[str, dict[str, str]]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Судья"},
    )
    assert response.status_code == 201, response.text
    session = snapshot_session(client)
    me = client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    return me.json()["id"], session


def grant_role(client, session, user_id: str, code: str) -> None:
    """Insert a `roles`/`user_roles` row for `user_id`, bypassing the API.

    `register` only ever produces a plain user; there is no endpoint that
    grants a role, so tests that need one reach into the database directly —
    the same approach `test_tournament_bracket_api.py` uses.
    """
    from uuid import UUID

    from sqlalchemy import select

    from app.modules.identity.models import Role, User, UserRole

    async def _grant() -> None:
        async with session.AsyncSessionLocal() as db:
            role = await db.scalar(select(Role).where(Role.code == code))
            if role is None:
                role = Role(code=code, name=code)
                db.add(role)
                await db.flush()
            user = await db.get(User, UUID(str(user_id)))
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()

    asyncio.run(_grant())


def test_only_word_is_accepted_for_rules(tmp_path):
    """Регламент правят и версионируют; таблица для этого не годится."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    admin_id, headers = register(client, "admin@example.com")
    grant_role(client, database_module, admin_id, "ADMIN")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    spreadsheet = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.xlsx", xlsx_bytes(), XLSX)},
    ).json()

    refused = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": spreadsheet["id"]},
    )
    assert refused.status_code == 400, refused.text
    assert "word" in refused.json()["detail"].lower()


def test_a_new_edition_does_not_take_the_old_editions_file(tmp_path):
    """История не переписывается: у старой редакции остаётся её файл."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    admin_id, headers = register(client, "admin@example.com")
    grant_role(client, database_module, admin_id, "ADMIN")

    first = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ARCHIVED"}
    ).json()
    document = client.post("/api/v1/media/uploads",
        files={"file": ("правила-1.docx", docx_bytes(), DOCX)}).json()
    client.post(
        f"/api/v1/rulesets/{first['id']}/documents",
        json={"title": "Редакция 1.0", "media_file_id": document["id"]},
    )

    second = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "2.0", "status": "ACTIVE"}
    ).json()

    assert len(client.get(f"/api/v1/rulesets/{first['id']}/documents").json()) == 1
    assert client.get(f"/api/v1/rulesets/{second['id']}/documents").json() == []


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
    ).json()

    refused = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": document["id"]},
    )
    assert refused.status_code == 403, refused.text


def test_the_rules_file_downloads_without_a_login(tmp_path):
    """Правила читают все — это их назначение."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    admin_id, headers = register(client, "admin@example.com")
    grant_role(client, database_module, admin_id, "ADMIN")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    document = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.docx", docx_bytes(), DOCX)},
    ).json()
    client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": document["id"]},
    )

    assert client.get(document["url"]).status_code == 200


def test_removing_a_rules_file_hides_it_and_keeps_the_bytes(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    admin_id, headers = register(client, "admin@example.com")
    grant_role(client, database_module, admin_id, "ADMIN")
    ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Правила", "version": "1.0", "status": "ACTIVE"}
    ).json()
    document = client.post(
        "/api/v1/media/uploads",
        files={"file": ("правила.docx", docx_bytes(), DOCX)},
    ).json()
    attached = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/documents",
        json={"title": "Правила", "media_file_id": document["id"]},
    ).json()

    removed = client.delete(
        f"/api/v1/rulesets/{ruleset['id']}/documents/{attached['id']}"
    )
    assert removed.status_code == 204, removed.text
    assert client.get(f"/api/v1/rulesets/{ruleset['id']}/documents").json() == []
    assert client.get(document["url"]).status_code == 200
