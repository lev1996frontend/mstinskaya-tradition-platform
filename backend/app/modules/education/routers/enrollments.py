from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.education.schemas.enrollment import EnrollmentCreateRequest, EnrollmentResponse
from app.modules.education.schemas.lesson_progress import LessonProgressCreateRequest, LessonProgressResponse
from app.modules.education.services.course_service import EducationService

router = APIRouter(prefix="/api/v1", tags=["education"])


@router.post("/enrollments", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def create_enrollment(payload: EnrollmentCreateRequest, session: AsyncSession = Depends(get_db)) -> EnrollmentResponse:
    enrollment = await EducationService.enroll_user(
        session,
        user_id=payload.user_id,
        course_id=payload.course_id,
    )
    await session.commit()
    return EnrollmentResponse(
        id=str(enrollment.id),
        user_id=str(enrollment.user_id),
        course_id=str(enrollment.course_id),
        status=enrollment.status,
        progress_percent=enrollment.progress_percent,
    )


@router.get("/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(user_id: str | None = None, session: AsyncSession = Depends(get_db)) -> list[EnrollmentResponse]:
    enrollments = await EducationService.list_enrollments(session, user_id=user_id)
    return [
        EnrollmentResponse(
            id=str(enrollment.id),
            user_id=str(enrollment.user_id),
            course_id=str(enrollment.course_id),
            status=enrollment.status,
            progress_percent=enrollment.progress_percent,
        )
        for enrollment in enrollments
    ]


@router.post("/lessons/progress", response_model=LessonProgressResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson_progress(payload: LessonProgressCreateRequest, session: AsyncSession = Depends(get_db)) -> LessonProgressResponse:
    progress = await EducationService.record_lesson_progress(
        session,
        user_id=payload.user_id,
        lesson_id=payload.lesson_id,
        completed=payload.completed,
    )
    await session.commit()
    return LessonProgressResponse(
        id=str(progress.id),
        user_id=str(progress.user_id),
        lesson_id=str(progress.lesson_id),
        completed=progress.completed,
    )
