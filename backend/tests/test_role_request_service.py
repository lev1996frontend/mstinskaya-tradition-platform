import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base
from app.modules.identity.models import Role, User, UserRole
from app.modules.role_requests.services.role_request_service import RoleRequestService


def _make_sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    async def setup_db():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def _make_user(email: str) -> User:
    return User(email=email, password_hash="x", first_name="A", last_name="B", status="active")


def test_create_request_rejects_unknown_role_code():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("u1@example.com")
            session.add(user)
            await session.flush()
            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.create_request(session, user=user, role_code="GHOST", justification="x")
            assert exc_info.value.status_code == 400

    asyncio.run(scenario())


def test_create_request_rejects_if_user_already_has_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("u2@example.com")
            session.add(user)
            role = Role(code="INSTRUCTOR", name="Instructor")
            session.add(role)
            await session.flush()
            session.add(UserRole(user_id=user.id, role_id=role.id))
            await session.flush()

            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.create_request(
                    session, user=user, role_code="INSTRUCTOR", justification="x"
                )
            assert exc_info.value.status_code == 400

    asyncio.run(scenario())


def test_create_request_rejects_duplicate_pending():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            user = _make_user("u3@example.com")
            session.add(user)
            await session.flush()
            await RoleRequestService.create_request(session, user=user, role_code="JUDGE", justification="first")

            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.create_request(
                    session, user=user, role_code="JUDGE", justification="second"
                )
            assert exc_info.value.status_code == 400

    asyncio.run(scenario())


def test_review_approve_grants_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant@example.com")
            reviewer = _make_user("reviewer@example.com")
            session.add_all([applicant, reviewer])
            session.add(Role(code="ORGANIZER", name="Organizer"))
            await session.flush()

            request_row = await RoleRequestService.create_request(
                session, user=applicant, role_code="ORGANIZER", justification="x"
            )
            await session.commit()

            reviewed = await RoleRequestService.review(
                session,
                request_id=str(request_row.id),
                reviewer=reviewer,
                decision="APPROVED",
                reason_code=None,
                reason_text=None,
            )
            await session.commit()

            assert reviewed.status == "APPROVED"
            assert reviewed.reviewed_by == reviewer.id

            from app.core.identity_access import get_role_codes

            codes = await get_role_codes(session, applicant.id)
            assert "ORGANIZER" in codes

    asyncio.run(scenario())


def test_review_reject_stores_reason_and_does_not_grant_role():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant2@example.com")
            reviewer = _make_user("reviewer2@example.com")
            session.add_all([applicant, reviewer])
            await session.flush()

            request_row = await RoleRequestService.create_request(
                session, user=applicant, role_code="JUDGE", justification="x"
            )
            await session.commit()

            reviewed = await RoleRequestService.review(
                session,
                request_id=str(request_row.id),
                reviewer=reviewer,
                decision="REJECTED",
                reason_code="INSUFFICIENT_EVIDENCE",
                reason_text=None,
            )
            await session.commit()

            assert reviewed.status == "REJECTED"
            assert reviewed.rejection_reason_code == "INSUFFICIENT_EVIDENCE"

            from app.core.identity_access import get_role_codes

            codes = await get_role_codes(session, applicant.id)
            assert "JUDGE" not in codes

    asyncio.run(scenario())


def test_review_already_resolved_request_raises_409():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant3@example.com")
            reviewer = _make_user("reviewer3@example.com")
            session.add_all([applicant, reviewer])
            session.add(Role(code="JUDGE", name="Judge"))
            await session.flush()

            request_row = await RoleRequestService.create_request(
                session, user=applicant, role_code="JUDGE", justification="x"
            )
            await session.commit()

            await RoleRequestService.review(
                session,
                request_id=str(request_row.id),
                reviewer=reviewer,
                decision="APPROVED",
                reason_code=None,
                reason_text=None,
            )
            await session.commit()

            with pytest.raises(HTTPException) as exc_info:
                await RoleRequestService.review(
                    session,
                    request_id=str(request_row.id),
                    reviewer=reviewer,
                    decision="APPROVED",
                    reason_code=None,
                    reason_text=None,
                )
            assert exc_info.value.status_code == 409

    asyncio.run(scenario())


def test_reapply_after_rejection_is_allowed():
    Session = _make_sessionmaker()

    async def scenario():
        async with Session() as session:
            applicant = _make_user("applicant4@example.com")
            reviewer = _make_user("reviewer4@example.com")
            session.add_all([applicant, reviewer])
            await session.flush()

            first = await RoleRequestService.create_request(
                session, user=applicant, role_code="INSTRUCTOR", justification="x"
            )
            await session.commit()
            await RoleRequestService.review(
                session,
                request_id=str(first.id),
                reviewer=reviewer,
                decision="REJECTED",
                reason_code="NOT_RECOGNIZED",
                reason_text=None,
            )
            await session.commit()

            second = await RoleRequestService.create_request(
                session, user=applicant, role_code="INSTRUCTOR", justification="y"
            )
            await session.commit()
            assert second.id != first.id

    asyncio.run(scenario())
