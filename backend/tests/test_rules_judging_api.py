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


def test_rules_and_judging_foundation_flow():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "judge@example.com",
            "password": "StrongPassword123!",
            "first_name": "Main",
            "last_name": "Judge",
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

    ruleset_response = client.post(
        "/api/v1/rulesets",
        json={
            "title": "Mstina Rules 2026",
            "description": "Base ruleset",
            "version": "2026.1",
            "status": "ACTIVE",
        },
    )
    assert ruleset_response.status_code == 201, ruleset_response.text
    ruleset = ruleset_response.json()
    assert ruleset["title"] == "Mstina Rules 2026"

    section_response = client.post(
        f"/api/v1/rulesets/{ruleset['id']}/sections",
        json={
            "title": "General conduct",
            "description": "Core principles",
            "order_number": 1,
        },
    )
    assert section_response.status_code == 201, section_response.text
    section = section_response.json()
    assert section["title"] == "General conduct"

    rule_response = client.post(
        f"/api/v1/sections/{section['id']}/rules",
        json={
            "title": "Safety first",
            "content": "All participants must maintain safe distance.",
            "rule_type": "SAFETY",
            "order_number": 1,
        },
    )
    assert rule_response.status_code == 201, rule_response.text
    rule = rule_response.json()
    assert rule["rule_type"] == "SAFETY"

    scenario_response = client.post(
        "/api/v1/judging/scenarios",
        json={
            "title": "Weapon edge check",
            "description": "Edge check during weapon exchange",
            "video_url": "https://example.com/video.mp4",
            "correct_decision": "WARNING",
            "judge_comment": "Disengage and reset position.",
            "category": "WEAPON",
        },
    )
    assert scenario_response.status_code == 201, scenario_response.text
    scenario = scenario_response.json()
    assert scenario["category"] == "WEAPON"

    certification_response = client.post(
        "/api/v1/judging/certifications",
        json={
            "user_id": user_id,
            "level": "REGIONAL",
            "status": "ACTIVE",
        },
    )
    assert certification_response.status_code == 201, certification_response.text
    certification = certification_response.json()
    assert certification["user_id"] == user_id
    assert certification["level"] == "REGIONAL"

    app.dependency_overrides.clear()
