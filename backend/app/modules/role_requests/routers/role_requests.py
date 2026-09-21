import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.email import EmailService
from app.core.identity_access import (
    User,
    get_emails_with_role_code,
    get_user_or_404,
    get_users_by_ids,
    has_permission,
)
from app.core.rate_limit import limiter
from app.core.session_auth import get_current_user as get_session_user
from app.modules.role_requests.models.role_request import RoleRequest
from app.modules.role_requests.schemas.role_request import (
    RoleRequestCreateRequest,
    RoleRequestResponse,
    RoleRequestReviewRequest,
)
from app.modules.role_requests.services.role_request_service import RoleRequestService

router = APIRouter(prefix="/api/v1/role-requests", tags=["role-requests"])
logger = logging.getLogger(__name__)

REVIEW_PERMISSION = "role_requests.review"


async def require_review_permission(
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not await has_permission(session, current_user.id, REVIEW_PERMISSION):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to review role requests")
    return current_user


def _applicant_name(user: User) -> str:
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email


def _to_response(request_row: RoleRequest, applicant: User) -> RoleRequestResponse:
    return RoleRequestResponse(
        id=str(request_row.id),
        user_id=str(request_row.user_id),
        applicant_email=applicant.email,
        applicant_name=_applicant_name(applicant),
        role_code=request_row.role_code,
        status=request_row.status,
        justification=request_row.justification,
        reviewed_by=str(request_row.reviewed_by) if request_row.reviewed_by else None,
        reviewed_at=request_row.reviewed_at,
        rejection_reason_code=request_row.rejection_reason_code,
        rejection_reason_text=request_row.rejection_reason_text,
        created_at=request_row.created_at,
        updated_at=request_row.updated_at,
    )


@router.post("", response_model=RoleRequestResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def create_role_request(
    request: Request,
    payload: RoleRequestCreateRequest,
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> RoleRequestResponse:
    request_row = await RoleRequestService.create_request(
        session, user=current_user, role_code=payload.role_code, justification=payload.justification
    )
    await session.commit()

    try:
        moderator_emails = await get_emails_with_role_code(session, "MODERATOR")
    except Exception:
        logger.exception("Failed to look up moderator emails for role-request-submitted notification")
        moderator_emails = []

    for moderator_email in moderator_emails:
        try:
            await run_in_threadpool(
                EmailService.send_role_request_submitted,
                to=moderator_email,
                role_code=request_row.role_code,
                applicant_name=_applicant_name(current_user),
            )
        except Exception:
            logger.exception("Failed to send role-request-submitted email to %s", moderator_email)

    return _to_response(request_row, current_user)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_role_request(
    request_id: str,
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await RoleRequestService.withdraw(session, request_id=request_id, user=current_user)
    await session.commit()


@router.get("/me", response_model=list[RoleRequestResponse])
async def list_my_role_requests(
    current_user: User = Depends(get_session_user),
    session: AsyncSession = Depends(get_db),
) -> list[RoleRequestResponse]:
    requests = await RoleRequestService.list_for_user(session, current_user.id)
    return [_to_response(row, current_user) for row in requests]


@router.get("", response_model=list[RoleRequestResponse])
async def list_role_requests(
    status_filter: Literal["PENDING", "APPROVED", "REJECTED"] | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_review_permission),
    session: AsyncSession = Depends(get_db),
) -> list[RoleRequestResponse]:
    requests = await RoleRequestService.list_for_review(
        session, status_filter=status_filter, limit=limit, offset=offset
    )
    applicants = await get_users_by_ids(session, {row.user_id for row in requests})
    return [_to_response(row, applicants[row.user_id]) for row in requests]


@router.patch("/{request_id}", response_model=RoleRequestResponse)
async def review_role_request(
    request_id: str,
    payload: RoleRequestReviewRequest,
    reviewer: User = Depends(require_review_permission),
    session: AsyncSession = Depends(get_db),
) -> RoleRequestResponse:
    request_row = await RoleRequestService.review(
        session,
        request_id=request_id,
        reviewer=reviewer,
        decision=payload.status,
        reason_code=payload.reason_code,
        reason_text=payload.reason_text,
    )
    applicant = await get_user_or_404(session, request_row.user_id)
    await session.commit()

    try:
        if request_row.status == "APPROVED":
            await run_in_threadpool(
                EmailService.send_role_request_approved, to=applicant.email, role_code=request_row.role_code
            )
        else:
            await run_in_threadpool(
                EmailService.send_role_request_rejected,
                to=applicant.email,
                role_code=request_row.role_code,
                reason_code=request_row.rejection_reason_code or "",
                reason_text=request_row.rejection_reason_text,
            )
    except Exception:
        logger.exception("Failed to send role-request decision email for request_id=%s", request_id)

    return _to_response(request_row, applicant)
