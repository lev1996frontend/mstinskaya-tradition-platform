from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identity_access import User, assign_role, get_role_codes
from app.modules.role_requests.models.role_request import REJECTION_REASON_CODES, ROLE_CODES, RoleRequest


class RoleRequestService:
    @staticmethod
    async def create_request(
        session: AsyncSession, *, user: User, role_code: str, justification: str
    ) -> RoleRequest:
        if role_code not in ROLE_CODES:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=f"Unknown role code: {role_code}")

        existing_role_codes = await get_role_codes(session, user.id)
        if role_code in existing_role_codes:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="User already has this role")

        pending = await session.scalar(
            select(RoleRequest).where(
                RoleRequest.user_id == user.id,
                RoleRequest.role_code == role_code,
                RoleRequest.status == "PENDING",
            )
        )
        if pending is not None:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="A pending request for this role already exists",
            )

        request_row = RoleRequest(user_id=user.id, role_code=role_code, status="PENDING", justification=justification)
        session.add(request_row)
        await session.flush()
        return request_row

    @staticmethod
    async def withdraw(session: AsyncSession, *, request_id: str, user: User) -> None:
        """Let a user retract their own still-open request.

        Hard-deletes the row rather than adding a fourth (WITHDRAWN) status:
        a withdrawn request carries no decision to audit — see the same
        "not historical correction" reasoning `review()` already applies to
        this module (docs/superpowers/specs/2026-09-15-role-requests-design.md)
        — and the partial unique index only covers status='PENDING' rows, so
        deleting also lets the user immediately resubmit for the same role.
        """
        try:
            request_uuid = UUID(request_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found") from None

        request_row = await session.scalar(
            select(RoleRequest).where(RoleRequest.id == request_uuid).with_for_update()
        )
        if request_row is None or request_row.user_id != user.id:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found")
        if request_row.status != "PENDING":
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="Role request already resolved")

        await session.delete(request_row)
        await session.flush()

    @staticmethod
    async def list_for_user(session: AsyncSession, user_id: UUID) -> list[RoleRequest]:
        rows = await session.scalars(
            select(RoleRequest).where(RoleRequest.user_id == user_id).order_by(RoleRequest.created_at.desc())
        )
        return list(rows)

    @staticmethod
    async def list_for_review(
        session: AsyncSession, *, status_filter: str | None, limit: int = 50, offset: int = 0
    ) -> list[RoleRequest]:
        query = select(RoleRequest).order_by(RoleRequest.created_at.desc())
        if status_filter is not None:
            query = query.where(RoleRequest.status == status_filter)
        query = query.limit(limit).offset(offset)
        rows = await session.scalars(query)
        return list(rows)

    @staticmethod
    async def review(
        session: AsyncSession,
        *,
        request_id: str,
        reviewer: User,
        decision: str,
        reason_code: str | None,
        reason_text: str | None,
    ) -> RoleRequest:
        try:
            request_uuid = UUID(request_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found") from None

        request_row = await session.scalar(
            select(RoleRequest).where(RoleRequest.id == request_uuid).with_for_update()
        )
        if request_row is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found")
        if request_row.status != "PENDING":
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="Role request already resolved")
        if request_row.user_id == reviewer.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="You cannot review your own role request",
            )

        if decision == "REJECTED":
            # Cross-field validity (reason_code required, reason_text
            # required for OTHER) is already enforced by
            # RoleRequestReviewRequest before this is called; this guard is
            # defense-in-depth for any other caller of this service.
            if reason_code not in REJECTION_REASON_CODES:
                raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid reason_code")
            request_row.status = "REJECTED"
            request_row.rejection_reason_code = reason_code
            request_row.rejection_reason_text = reason_text if reason_code == "OTHER" else None
        elif decision == "APPROVED":
            request_row.status = "APPROVED"
            await assign_role(session, request_row.user_id, request_row.role_code)
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="decision must be APPROVED or REJECTED",
            )

        request_row.reviewed_by = reviewer.id
        request_row.reviewed_at = datetime.now(timezone.utc)
        await session.flush()
        return request_row
