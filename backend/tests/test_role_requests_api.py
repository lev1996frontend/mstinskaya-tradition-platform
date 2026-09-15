import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.core import email as email_module
from app.main import app
from app.models.base import Base
from app.modules.identity.models import Permission, Role, RolePermission, User, UserRole
from tests.auth_test_helpers import snapshot_session, use_session


def setup_client(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        # Mirror the role seed from migrations/versions/20260915_role_requests.py:
        # these roles only exist in real deployments because that migration
        # inserts them, but this test DB is built from Base.metadata.create_all
        # (no migrations), so assign_role would 500 on approval without this.
        session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            for code, name in [
                ("INSTRUCTOR", "Instructor"),
                ("ORGANIZER", "Organizer"),
                ("JUDGE", "Judge"),
                ("MODERATOR", "Moderator"),
            ]:
                existing = await session.scalar(select(Role).where(Role.code == code))
                if existing is None:
                    session.add(Role(code=code, name=name))
            await session.commit()

    asyncio.run(setup_db())

    async def database_session():
        async with database_module.AsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[database_module.get_db] = database_session

    submitted: list[dict] = []
    approved: list[dict] = []
    rejected: list[dict] = []
    monkeypatch.setattr(
        email_module.EmailService,
        "send_role_request_submitted",
        staticmethod(lambda **kwargs: submitted.append(kwargs)),
    )
    monkeypatch.setattr(
        email_module.EmailService,
        "send_role_request_approved",
        staticmethod(lambda **kwargs: approved.append(kwargs)),
    )
    monkeypatch.setattr(
        email_module.EmailService,
        "send_role_request_rejected",
        staticmethod(lambda **kwargs: rejected.append(kwargs)),
    )

    return TestClient(app), {"submitted": submitted, "approved": approved, "rejected": rejected}


def _register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Т", "last_name": "Т"},
    )
    assert response.status_code == 201, response.text


def _grant_moderator(email: str) -> None:
    async def scenario():
        async with database_module.AsyncSessionLocal() as session:
            user = await session.scalar(select(User).where(User.email == email))
            role = await session.scalar(select(Role).where(Role.code == "MODERATOR"))
            if role is None:
                role = Role(code="MODERATOR", name="Moderator")
                session.add(role)
                await session.flush()
            permission = await session.scalar(select(Permission).where(Permission.code == "role_requests.review"))
            if permission is None:
                permission = Permission(code="role_requests.review", name="Review role requests")
                session.add(permission)
                await session.flush()
            link = await session.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == role.id, RolePermission.permission_id == permission.id
                )
            )
            if link is None:
                session.add(RolePermission(role_id=role.id, permission_id=permission.id))
            existing = await session.scalar(
                select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id)
            )
            if existing is None:
                session.add(UserRole(user_id=user.id, role_id=role.id))
            await session.commit()

    asyncio.run(scenario())


def test_create_request_sends_email_to_moderators(monkeypatch):
    client, mail = setup_client(monkeypatch)
    _register(client, "mod@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod@example.com")

    _register(client, "applicant@example.com")
    response = client.post(
        "/api/v1/role-requests", json={"role_code": "INSTRUCTOR", "justification": "тренирую 2 года"}
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "PENDING"
    assert response.json()["applicant_email"] == "applicant@example.com"
    assert len(mail["submitted"]) == 1
    assert mail["submitted"][0]["to"] == "mod@example.com"
    app.dependency_overrides.clear()


def test_create_request_unknown_role_is_422(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "applicant2@example.com")
    response = client.post("/api/v1/role-requests", json={"role_code": "GHOST", "justification": "x"})
    assert response.status_code == 422, response.text
    app.dependency_overrides.clear()


def test_create_request_duplicate_pending_is_400(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "applicant3@example.com")
    first = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "x"})
    assert first.status_code == 201, first.text
    second = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "y"})
    assert second.status_code == 400, second.text
    app.dependency_overrides.clear()


def test_get_me_returns_only_own_requests(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "user_a@example.com")
    user_a_session = snapshot_session(client)
    client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "a"})

    _register(client, "user_b@example.com")
    client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "b"})

    use_session(client, user_a_session)
    response = client.get("/api/v1/role-requests/me")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["applicant_email"] == "user_a@example.com"
    app.dependency_overrides.clear()


def test_list_and_review_require_moderator_permission(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "applicant4@example.com")
    request_response = client.post(
        "/api/v1/role-requests", json={"role_code": "ORGANIZER", "justification": "x"}
    )
    request_id = request_response.json()["id"]

    list_response = client.get("/api/v1/role-requests")
    assert list_response.status_code == 403, list_response.text

    patch_response = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert patch_response.status_code == 403, patch_response.text
    app.dependency_overrides.clear()


def test_moderator_approves_request_and_role_is_granted(monkeypatch):
    client, mail = setup_client(monkeypatch)
    _register(client, "mod2@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod2@example.com")

    _register(client, "applicant5@example.com")
    applicant_session = snapshot_session(client)
    request_response = client.post(
        "/api/v1/role-requests", json={"role_code": "ORGANIZER", "justification": "x"}
    )
    request_id = request_response.json()["id"]

    use_session(client, mod_session)
    list_response = client.get("/api/v1/role-requests", params={"status": "PENDING"})
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()) == 1

    patch_response = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["status"] == "APPROVED"
    assert len(mail["approved"]) == 1
    assert mail["approved"][0]["to"] == "applicant5@example.com"

    use_session(client, applicant_session)
    me_response = client.get("/api/v1/users/me")
    assert "ORGANIZER" in me_response.json()["roles"]
    app.dependency_overrides.clear()


def test_moderator_rejects_request_with_reason(monkeypatch):
    client, mail = setup_client(monkeypatch)
    _register(client, "mod3@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod3@example.com")

    _register(client, "applicant6@example.com")
    request_response = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "x"})
    request_id = request_response.json()["id"]

    use_session(client, mod_session)
    reject_without_reason = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "REJECTED"})
    assert reject_without_reason.status_code == 422, reject_without_reason.text

    reject_other_without_text = client.patch(
        f"/api/v1/role-requests/{request_id}", json={"status": "REJECTED", "reason_code": "OTHER"}
    )
    assert reject_other_without_text.status_code == 422, reject_other_without_text.text

    reject_response = client.patch(
        f"/api/v1/role-requests/{request_id}",
        json={"status": "REJECTED", "reason_code": "DUPLICATE_REQUEST"},
    )
    assert reject_response.status_code == 200, reject_response.text
    assert reject_response.json()["rejection_reason_code"] == "DUPLICATE_REQUEST"
    assert len(mail["rejected"]) == 1
    assert mail["rejected"][0]["to"] == "applicant6@example.com"
    app.dependency_overrides.clear()


def test_review_already_resolved_request_is_409(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "mod4@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod4@example.com")

    _register(client, "applicant7@example.com")
    request_response = client.post("/api/v1/role-requests", json={"role_code": "JUDGE", "justification": "x"})
    request_id = request_response.json()["id"]

    use_session(client, mod_session)
    first = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert first.status_code == 200, first.text

    second = client.patch(f"/api/v1/role-requests/{request_id}", json={"status": "APPROVED"})
    assert second.status_code == 409, second.text
    app.dependency_overrides.clear()


def test_reapply_after_rejection_succeeds(monkeypatch):
    client, _ = setup_client(monkeypatch)
    _register(client, "mod6@example.com")
    mod_session = snapshot_session(client)
    _grant_moderator("mod6@example.com")

    _register(client, "applicant9@example.com")
    applicant_session = snapshot_session(client)
    first_request = client.post("/api/v1/role-requests", json={"role_code": "INSTRUCTOR", "justification": "x"})
    request_id = first_request.json()["id"]

    use_session(client, mod_session)
    reject = client.patch(
        f"/api/v1/role-requests/{request_id}", json={"status": "REJECTED", "reason_code": "NOT_RECOGNIZED"}
    )
    assert reject.status_code == 200, reject.text

    use_session(client, applicant_session)
    retry = client.post("/api/v1/role-requests", json={"role_code": "INSTRUCTOR", "justification": "y"})
    assert retry.status_code == 201, retry.text
    assert retry.json()["id"] != request_id
    app.dependency_overrides.clear()
