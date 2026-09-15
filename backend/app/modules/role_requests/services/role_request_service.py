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
    async def list_for_user(session: AsyncSession, user_id: UUID) -> list[RoleRequest]:
        rows = await session.scalars(
            select(RoleRequest).where(RoleRequest.user_id == user_id).order_by(RoleRequest.created_at.desc())
        )
        return list(rows)

    @staticmethod
    async def list_for_review(session: AsyncSession, *, status_filter: str | None) -> list[RoleRequest]:
        query = select(RoleRequest).order_by(RoleRequest.created_at.desc())
        if status_filter is not None:
            query = query.where(RoleRequest.status == status_filter)
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

        request_row = await session.get(RoleRequest, request_uuid)
        if request_row is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role request not found")
        if request_row.status != "PENDING":
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="Role request already resolved")

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
        else:
            request_row.status = "APPROVED"
            await assign_role(session, request_row.user_id, request_row.role_code)

        request_row.reviewed_by = reviewer.id
        request_row.reviewed_at = datetime.now(timezone.utc)
        await session.flush()
        return request_row
