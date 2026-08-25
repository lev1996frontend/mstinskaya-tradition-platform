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


def test_course_module_lesson_and_enrollment_flow():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "student@example.com",
            "password": "StrongPassword123!",
            "first_name": "Student",
            "last_name": "User",
        },
    )
    assert register_response.status_code == 201, register_response.text
    token = register_response.json()["access_token"]

    me_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200, me_response.text
    user_id = me_response.json()["id"]

    course_response = client.post(
        "/api/v1/courses",
        json={
            "title": "Fundamentals of Mstina",
            "description": "Basic training foundation",
            "type": "GENERAL",
            "level": "BEGINNER",
            "thumbnail_url": "https://example.com/thumb.png",
            "is_published": True,
        },
    )
    assert course_response.status_code == 201, course_response.text
    course = course_response.json()
    assert course["title"] == "Fundamentals of Mstina"

    module_response = client.post(
        f"/api/v1/courses/{course['id']}/modules",
        json={
            "title": "Introduction",
            "description": "First steps",
            "order_number": 1,
        },
    )
    assert module_response.status_code == 201, module_response.text
    module = module_response.json()
    assert module["title"] == "Introduction"

    lesson_response = client.post(
        f"/api/v1/modules/{module['id']}/lessons",
        json={
            "title": "Warmup",
            "description": "Movement warmup",
            "content_type": "VIDEO",
            "video_url": "https://example.com/lesson.mp4",
            "duration_minutes": 12,
            "order_number": 1,
        },
    )
    assert lesson_response.status_code == 201, lesson_response.text
    lesson = lesson_response.json()
    assert lesson["title"] == "Warmup"

    enroll_response = client.post(
        "/api/v1/enrollments",
        json={
            "user_id": user_id,
            "course_id": course["id"],
        },
    )
    assert enroll_response.status_code == 201, enroll_response.text
    enrollment = enroll_response.json()
    assert enrollment["user_id"] == user_id
    assert enrollment["course_id"] == course["id"]

    progress_response = client.post(
        "/api/v1/lessons/progress",
        json={
            "user_id": user_id,
            "lesson_id": lesson["id"],
            "completed": True,
        },
    )
    assert progress_response.status_code == 201, progress_response.text
    progress = progress_response.json()
    assert progress["completed"] is True

    course_detail = client.get(f"/api/v1/courses/{course['id']}")
    assert course_detail.status_code == 200, course_detail.text
    assert course_detail.json()["title"] == "Fundamentals of Mstina"

    app.dependency_overrides.clear()
