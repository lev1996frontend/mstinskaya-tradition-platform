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
    token = register_response.json()["access_token"]

    me_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
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
            "uploaded_by": uploaded_by,
        },
    )
    assert file_response.status_code == 201, file_response.text
    file_data = file_response.json()
    assert file_data["filename"] == "intro.mp4"
    assert file_data["type"] == "VIDEO"

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
