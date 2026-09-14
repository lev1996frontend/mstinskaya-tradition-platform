import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base


def setup_app_for_tests():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

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


def test_media_foundation_flow():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "media@example.com",
            "password": "StrongPassword123!",
            "first_name": "Media",
            "last_name": "Owner",
        },
    )
    assert register_response.status_code == 201, register_response.text

    me_response = client.get("/api/v1/users/me")
    assert me_response.status_code == 200, me_response.text
    uploaded_by = me_response.json()["id"]

    file_response = client.post(
        "/api/v1/media/files",
        json={
            "filename": "intro.mp4",
            "original_name": "intro.mp4",
            "storage_key": "videos/intro.mp4",
            "url": "https://example.com/videos/intro.mp4",
            "type": "VIDEO",
            "size": 102400,
            "mime_type": "video/mp4",
        },
    )
    assert file_response.status_code == 201, file_response.text
    file_data = file_response.json()
    assert file_data["filename"] == "intro.mp4"
    assert file_data["type"] == "VIDEO"
    # uploaded_by is derived server-side from the authenticated caller, not
    # taken from the request body.
    assert file_data["uploaded_by"] == uploaded_by

    video_response = client.post(
        "/api/v1/media/videos",
        json={
            "media_file_id": file_data["id"],
            "title": "Intro lesson",
            "description": "Warmup walkthrough",
            "duration_seconds": 360,
            "preview_image_id": None,
        },
    )
    assert video_response.status_code == 201, video_response.text
    assert video_response.json()["title"] == "Intro lesson"

    document_response = client.post(
        "/api/v1/media/documents",
        json={
            "media_file_id": file_data["id"],
            "title": "Rules overview",
            "description": "Summary of technical rules",
            "document_type": "RULES",
        },
    )
    assert document_response.status_code == 201, document_response.text
    assert document_response.json()["document_type"] == "RULES"

    access_response = client.post(
        "/api/v1/media/access",
        json={
            "media_file_id": file_data["id"],
            "access_level": "USER",
        },
    )
    assert access_response.status_code == 201, access_response.text
    assert access_response.json()["access_level"] == "USER"

    app.dependency_overrides.clear()


def test_uploaded_by_cannot_be_spoofed_by_the_request_body():
    """A logged-in caller cannot attribute a recorded file to someone else's id.

    `uploaded_by` used to come straight from the request body; the server now
    always uses the authenticated caller's id, regardless of what the payload
    claims.
    """
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "spoofer@example.com",
            "password": "StrongPassword123!",
            "first_name": "Spoof",
            "last_name": "Attempt",
        },
    )
    assert register_response.status_code == 201, register_response.text

    me_response = client.get("/api/v1/users/me")
    assert me_response.status_code == 200, me_response.text
    caller_id = me_response.json()["id"]

    someone_elses_id = "00000000-0000-0000-0000-000000000042"
    file_response = client.post(
        "/api/v1/media/files",
        json={
            "filename": "intro.mp4",
            "original_name": "intro.mp4",
            "storage_key": "videos/intro.mp4",
            "url": "https://example.com/videos/intro.mp4",
            "type": "VIDEO",
            "size": 102400,
            "mime_type": "video/mp4",
            "uploaded_by": someone_elses_id,
        },
    )
    assert file_response.status_code == 201, file_response.text
    assert file_response.json()["uploaded_by"] == caller_id

    app.dependency_overrides.clear()
