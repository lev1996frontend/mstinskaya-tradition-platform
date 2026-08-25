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


def test_equipment_catalog_foundation_flow():
    client = setup_app_for_tests()

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "equipment@example.com",
            "password": "StrongPassword123!",
            "first_name": "Equipment",
            "last_name": "Buyer",
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

    supplier_response = client.post(
        "/api/v1/equipment/suppliers",
        json={
            "name": "Mstina Shop",
            "description": "Official supplier",
            "website": "https://example.com",
            "email": "contact@example.com",
            "phone": "+375291234567",
            "city": "Minsk",
            "country": "Belarus",
        },
    )
    assert supplier_response.status_code == 201, supplier_response.text
    supplier_id = supplier_response.json()["id"]

    category_response = client.post(
        "/api/v1/equipment/categories",
        json={
            "name": "Protective gear",
            "description": "Body protection",
        },
    )
    assert category_response.status_code == 201, category_response.text
    category_id = category_response.json()["id"]

    product_response = client.post(
        "/api/v1/equipment/products",
        json={
            "category_id": category_id,
            "supplier_id": supplier_id,
            "name": "Shin guard",
            "description": "Training shin guard",
            "manufacturer": "Mstina",
            "price": 89.99,
            "currency": "BYN",
            "status": "ACTIVE",
        },
    )
    assert product_response.status_code == 201, product_response.text
    product_id = product_response.json()["id"]

    media_file_response = client.post(
        "/api/v1/media/files",
        json={
            "filename": "guard.jpg",
            "original_name": "guard.jpg",
            "storage_key": "equipment/guard.jpg",
            "url": "https://example.com/equipment/guard.jpg",
            "type": "IMAGE",
            "size": 12000,
            "mime_type": "image/jpeg",
            "uploaded_by": user_id,
        },
    )
    assert media_file_response.status_code == 201, media_file_response.text
    media_file_id = media_file_response.json()["id"]

    media_response = client.post(
        "/api/v1/equipment/products/media",
        json={
            "product_id": product_id,
            "media_file_id": media_file_id,
            "order_number": 1,
        },
    )
    assert media_response.status_code == 201, media_response.text
    assert media_response.json()["order_number"] == 1

    request_response = client.post(
        "/api/v1/equipment/requests",
        json={
            "user_id": user_id,
            "product_id": product_id,
            "quantity": 2,
            "comment": "Need for club training",
            "status": "NEW",
        },
    )
    assert request_response.status_code == 201, request_response.text
    assert request_response.json()["status"] == "NEW"

    app.dependency_overrides.clear()
