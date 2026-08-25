from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.education.models import Course, Enrollment, Lesson, LessonProgress, Module
from app.modules.identity.models import User


class EducationService:
    @staticmethod
    async def create_course(
        session: AsyncSession,
        *,
        title: str,
        description: str | None,
        type: str,
        level: str,
        thumbnail_url: str | None,
        is_published: bool,
    ) -> Course:
        normalized_type = str(type).upper()
        valid_types = {"GENERAL", "ATHLETE", "INSTRUCTOR", "JUDGE"}
        if normalized_type not in valid_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course type")

        normalized_level = str(level).upper()
        valid_levels = {"BEGINNER", "INTERMEDIATE", "ADVANCED"}
        if normalized_level not in valid_levels:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course level")

        course = Course(
            title=title,
            description=description,
            type=normalized_type,
            level=normalized_level,
            thumbnail_url=thumbnail_url,
            is_published=is_published,
        )
        session.add(course)
        await session.flush()
        return course

    @staticmethod
    async def get_course(session: AsyncSession, course_id: str) -> Course:
        try:
            parsed_course_id = UUID(str(course_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course id") from None

        course = await session.get(Course, parsed_course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course

    @staticmethod
    async def list_courses(session: AsyncSession) -> list[Course]:
        result = await session.execute(select(Course).order_by(Course.created_at.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def create_module(session: AsyncSession, *, course_id: str, title: str, description: str | None, order_number: int) -> Module:
        course = await EducationService.get_course(session, course_id)

        module = Module(
            course_id=course.id,
            title=title,
            description=description,
            order_number=order_number,
        )
        session.add(module)
        await session.flush()
        return module

    @staticmethod
    async def get_module(session: AsyncSession, module_id: str) -> Module:
        try:
            parsed_module_id = UUID(str(module_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid module id") from None

        module = await session.get(Module, parsed_module_id)
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
        return module

    @staticmethod
    async def list_modules(session: AsyncSession, course_id: str) -> list[Module]:
        course = await EducationService.get_course(session, course_id)
        result = await session.execute(
            select(Module).where(Module.course_id == course.id).order_by(Module.order_number.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_lesson(
        session: AsyncSession,
        *,
        module_id: str,
        title: str,
        description: str | None,
        content_type: str,
        video_url: str | None,
        document_url: str | None,
        duration_minutes: int | None,
        order_number: int,
    ) -> Lesson:
        module = await EducationService.get_module(session, module_id)
        normalized_content_type = str(content_type).upper()
        valid_types = {"VIDEO", "TEXT", "DOCUMENT"}
        if normalized_content_type not in valid_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid lesson content type")

        lesson = Lesson(
            module_id=module.id,
            title=title,
            description=description,
            content_type=normalized_content_type,
            video_url=video_url,
            document_url=document_url,
            duration_minutes=duration_minutes,
            order_number=order_number,
        )
        session.add(lesson)
        await session.flush()
        return lesson

    @staticmethod
    async def get_lesson(session: AsyncSession, lesson_id: str) -> Lesson:
        try:
            parsed_lesson_id = UUID(str(lesson_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid lesson id") from None

        lesson = await session.get(Lesson, parsed_lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
        return lesson

    @staticmethod
    async def list_lessons(session: AsyncSession, module_id: str) -> list[Lesson]:
        module = await EducationService.get_module(session, module_id)
        result = await session.execute(
            select(Lesson).where(Lesson.module_id == module.id).order_by(Lesson.order_number.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def enroll_user(session: AsyncSession, *, user_id: str, course_id: str) -> Enrollment:
        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        try:
            parsed_course_id = UUID(str(course_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course id") from None

        user = await session.get(User, parsed_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        course = await session.get(Course, parsed_course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        existing = await session.scalar(
            select(Enrollment).where(Enrollment.user_id == parsed_user_id, Enrollment.course_id == parsed_course_id)
        )
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already enrolled in this course")

        enrollment = Enrollment(
            user_id=parsed_user_id,
            course_id=parsed_course_id,
            status="STARTED",
            progress_percent=0,
        )
        session.add(enrollment)
        await session.flush()
        return enrollment

    @staticmethod
    async def get_enrollment(session: AsyncSession, enrollment_id: str) -> Enrollment:
        try:
            parsed_enrollment_id = UUID(str(enrollment_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid enrollment id") from None

        enrollment = await session.get(Enrollment, parsed_enrollment_id)
        if enrollment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
        return enrollment

    @staticmethod
    async def list_enrollments(session: AsyncSession, user_id: str | None = None) -> list[Enrollment]:
        query = select(Enrollment)
        if user_id is not None:
            try:
                parsed_user_id = UUID(str(user_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None
            query = query.where(Enrollment.user_id == parsed_user_id)
        result = await session.execute(query.order_by(Enrollment.created_at.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def record_lesson_progress(
        session: AsyncSession,
        *,
        user_id: str,
        lesson_id: str,
        completed: bool,
    ) -> LessonProgress:
        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        try:
            parsed_lesson_id = UUID(str(lesson_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid lesson id") from None

        user = await session.get(User, parsed_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        lesson = await session.get(Lesson, parsed_lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        existing = await session.scalar(
            select(LessonProgress).where(LessonProgress.user_id == parsed_user_id, LessonProgress.lesson_id == parsed_lesson_id)
        )
        if existing is not None:
            existing.completed = completed
            existing.updated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            await session.flush()
            return existing

        progress = LessonProgress(user_id=parsed_user_id, lesson_id=parsed_lesson_id, completed=completed)
        session.add(progress)
        await session.flush()
        return progress
