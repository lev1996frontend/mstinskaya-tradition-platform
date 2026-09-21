"""Документы турнира ссылаются на файл.

Until now a `tournament_documents` row was only ever a bare `file_url` pointing
somewhere else. This adds a second way to fill that row — an uploaded file —
without breaking the first: an old положение linked from elsewhere must keep
resolving. Removing a document is taking it off the page, not deleting it, so
the underlying file and its download link stay alive after removal.
"""

import asyncio
from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base
from tests.auth_test_helpers import snapshot_session

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


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
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор", "privacy_consent": True},
    )
    assert response.status_code == 201, response.text
    session = snapshot_session(client)
    me = client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    return me.json()["id"], session


def bootstrap(client):
    """A tournament with three disciplines, one of them age-bounded."""
    organizer_id, session = register(client, "organizer@example.com")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Мстинская традиция 2026",
            "status": "REGISTRATION",
            "start_date": "2026-05-16",
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    return tournament.json()["id"], session


def test_an_uploaded_file_becomes_a_tournament_document(tmp_path):
    """Загрузили файл, приложили к турниру, скачали по ссылке из списка."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)

    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
    ).json()

    created = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение", "media_file_id": uploaded["id"], "type": "POSITION"},
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
    tournament_id, session = bootstrap(client)

    created = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Регламент", "file_url": "https://example.org/reg.docx"},
    )
    assert created.status_code == 201, created.text


def test_a_document_neither_uploaded_nor_linked_is_refused(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)

    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Ничто"},
    )
    assert refused.status_code == 422, refused.text


def test_removing_a_document_hides_it_but_keeps_the_file(tmp_path):
    """Снятие со страницы — не удаление: старое положение могли процитировать."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)
    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
    ).json()
    document = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение", "media_file_id": uploaded["id"]},
    ).json()

    removed = client.delete(
        f"/api/v1/tournaments/{tournament_id}/documents/{document['id']}"
    )
    assert removed.status_code == 204, removed.text
    assert client.get(f"/api/v1/tournaments/{tournament_id}/documents").json() == []
    assert client.get(uploaded["url"]).status_code == 200, "файл остаётся живым"


def test_an_unparsable_media_file_id_is_a_bad_request_not_a_crash(tmp_path):
    """Same convention as get_tournament: malformed id is 400, not a 500."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)

    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение", "media_file_id": "not-a-uuid"},
    )
    assert refused.status_code == 400, refused.text


def test_removing_with_an_unparsable_document_id_is_a_bad_request_not_a_crash(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)

    refused = client.delete(
        f"/api/v1/tournaments/{tournament_id}/documents/not-a-uuid"
    )
    assert refused.status_code == 400, refused.text


def test_attaching_the_same_file_twice_to_the_same_tournament_is_a_conflict(tmp_path):
    """The spec's 409: attaching the same stored file to the same tournament
    a second time is refused, naming the document that already has it."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)
    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
    ).json()

    first = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение (черновик)", "media_file_id": uploaded["id"], "type": "POSITION"},
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение (копия)", "media_file_id": uploaded["id"], "type": "POSITION"},
    )
    assert second.status_code == 409, second.text
    assert "Положение (черновик)" in second.json()["detail"]


def test_attaching_the_same_file_to_a_different_tournament_still_succeeds(tmp_path):
    """The 409 is scoped to one tournament — a second, unrelated tournament
    can cite the same uploaded file with no conflict."""
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)
    uploaded = client.post(
        "/api/v1/media/uploads",
        files={"file": ("положение.docx", docx_bytes(), DOCX)},
    ).json()

    first = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Положение", "media_file_id": uploaded["id"], "type": "POSITION"},
    )
    assert first.status_code == 201, first.text

    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    me = client.get("/api/v1/users/me").json()
    other_tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Мстинская традиция 2027",
            "status": "REGISTRATION",
            "start_date": "2027-05-16",
            "organizer_id": me["id"],
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert other_tournament.status_code == 201, other_tournament.text
    other_tournament_id = other_tournament.json()["id"]

    second = client.post(
        f"/api/v1/tournaments/{other_tournament_id}/documents",
        json={"title": "Положение", "media_file_id": uploaded["id"], "type": "POSITION"},
    )
    assert second.status_code == 201, second.text


def test_attaching_a_document_requires_a_manager(tmp_path):
    client = setup_app_for_tests()
    use_temp_storage(tmp_path)
    tournament_id, session = bootstrap(client)
    _, stranger = register(client, "stranger@example.com")

    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/documents",
        json={"title": "Чужое", "file_url": "https://example.org/x.docx"},
    )
    assert refused.status_code == 403, refused.text


# ---------------------------------------------------------- смена регламента
# A tournament names exactly one ruleset edition at creation and, until now,
# never again — there was no way back from a wrong pick or a later revision.


def test_the_organizer_can_repoint_the_tournament_at_another_edition():
    client = setup_app_for_tests()
    tournament_id, session = bootstrap(client)
    second_ruleset = client.post(
        "/api/v1/rulesets", json={"title": "Base", "version": "2.0", "status": "ACTIVE"}
    )
    assert second_ruleset.status_code == 201, second_ruleset.text

    updated = client.patch(
        f"/api/v1/tournaments/{tournament_id}/ruleset",
        json={"ruleset_id": second_ruleset.json()["id"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["ruleset_id"] == second_ruleset.json()["id"]

    # The change is real, not just echoed back — a fresh read shows it too.
    fetched = client.get(f"/api/v1/tournaments/{tournament_id}")
    assert fetched.json()["ruleset_id"] == second_ruleset.json()["id"]


def test_repointing_at_a_nonexistent_edition_is_refused():
    client = setup_app_for_tests()
    tournament_id, session = bootstrap(client)

    refused = client.patch(
        f"/api/v1/tournaments/{tournament_id}/ruleset",
        json={"ruleset_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert refused.status_code == 404, refused.text


def test_repointing_with_a_malformed_id_is_a_bad_request_not_a_crash():
    client = setup_app_for_tests()
    tournament_id, session = bootstrap(client)

    refused = client.patch(
        f"/api/v1/tournaments/{tournament_id}/ruleset",
        json={"ruleset_id": "not-a-uuid"},
    )
    assert refused.status_code == 400, refused.text


def test_repointing_requires_a_manager():
    client = setup_app_for_tests()
    tournament_id, _ = bootstrap(client)
    _, stranger = register(client, "stranger-ruleset@example.com")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "3.0", "status": "ACTIVE"})

    refused = client.patch(
        f"/api/v1/tournaments/{tournament_id}/ruleset",
        json={"ruleset_id": ruleset.json()["id"]},
    )
    assert refused.status_code == 403, refused.text


def test_repointing_without_a_login_is_refused():
    client = setup_app_for_tests()
    tournament_id, _ = bootstrap(client)
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "4.0", "status": "ACTIVE"})

    client.cookies.clear()
    refused = client.patch(
        f"/api/v1/tournaments/{tournament_id}/ruleset",
        json={"ruleset_id": ruleset.json()["id"]},
    )
    assert refused.status_code == 401, refused.text
