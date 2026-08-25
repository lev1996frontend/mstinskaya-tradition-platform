from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.education.schemas.course import CourseCreateRequest, CourseResponse
from app.modules.education.schemas.lesson import LessonCreateRequest, LessonResponse
from app.modules.education.schemas.module import ModuleCreateRequest, ModuleResponse
from app.modules.education.services.course_service import EducationService

router = APIRouter(prefix="/api/v1", tags=["education"])


@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(payload: CourseCreateRequest, session: AsyncSession = Depends(get_db)) -> CourseResponse:
    course = await EducationService.create_course(
        session,
        title=payload.title,
        description=payload.description,
        type=payload.type,
        level=payload.level,
        thumbnail_url=payload.thumbnail_url,
        is_published=payload.is_published,
    )
    await session.commit()
    return CourseResponse(
        id=str(course.id),
        title=course.title,
        description=course.description,
        type=course.type,
        level=course.level,
        thumbnail_url=course.thumbnail_url,
        is_published=course.is_published,
    )


@router.get("/courses", response_model=list[CourseResponse])
async def list_courses(session: AsyncSession = Depends(get_db)) -> list[CourseResponse]:
    courses = await EducationService.list_courses(session)
    return [
        CourseResponse(
            id=str(course.id),
            title=course.title,
            description=course.description,
            type=course.type,
            level=course.level,
            thumbnail_url=course.thumbnail_url,
            is_published=course.is_published,
        )
        for course in courses
    ]


@router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str, session: AsyncSession = Depends(get_db)) -> CourseResponse:
    course = await EducationService.get_course(session, course_id)
    return CourseResponse(
        id=str(course.id),
        title=course.title,
        description=course.description,
        type=course.type,
        level=course.level,
        thumbnail_url=course.thumbnail_url,
        is_published=course.is_published,
    )


@router.post("/courses/{course_id}/modules", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_module(course_id: str, payload: ModuleCreateRequest, session: AsyncSession = Depends(get_db)) -> ModuleResponse:
    module = await EducationService.create_module(
        session,
        course_id=course_id,
        title=payload.title,
        description=payload.description,
        order_number=payload.order_number,
    )
    await session.commit()
    return ModuleResponse(
        id=str(module.id),
        course_id=str(module.course_id),
        title=module.title,
        description=module.description,
        order_number=module.order_number,
    )


@router.get("/courses/{course_id}/modules", response_model=list[ModuleResponse])
async def list_modules(course_id: str, session: AsyncSession = Depends(get_db)) -> list[ModuleResponse]:
    modules = await EducationService.list_modules(session, course_id)
    return [
        ModuleResponse(
            id=str(module.id),
            course_id=str(module.course_id),
            title=module.title,
            description=module.description,
            order_number=module.order_number,
        )
        for module in modules
    ]


@router.post("/modules/{module_id}/lessons", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(module_id: str, payload: LessonCreateRequest, session: AsyncSession = Depends(get_db)) -> LessonResponse:
    lesson = await EducationService.create_lesson(
        session,
        module_id=module_id,
        title=payload.title,
        description=payload.description,
        content_type=payload.content_type,
        video_url=payload.video_url,
        document_url=payload.document_url,
        duration_minutes=payload.duration_minutes,
        order_number=payload.order_number,
    )
    await session.commit()
    return LessonResponse(
        id=str(lesson.id),
        module_id=str(lesson.module_id),
        title=lesson.title,
        description=lesson.description,
        content_type=lesson.content_type,
        video_url=lesson.video_url,
        document_url=lesson.document_url,
        duration_minutes=lesson.duration_minutes,
        order_number=lesson.order_number,
    )


@router.get("/modules/{module_id}/lessons", response_model=list[LessonResponse])
async def list_lessons(module_id: str, session: AsyncSession = Depends(get_db)) -> list[LessonResponse]:
    lessons = await EducationService.list_lessons(session, module_id)
    return [
        LessonResponse(
            id=str(lesson.id),
            module_id=str(lesson.module_id),
            title=lesson.title,
            description=lesson.description,
            content_type=lesson.content_type,
            video_url=lesson.video_url,
            document_url=lesson.document_url,
            duration_minutes=lesson.duration_minutes,
            order_number=lesson.order_number,
        )
        for lesson in lessons
    ]
