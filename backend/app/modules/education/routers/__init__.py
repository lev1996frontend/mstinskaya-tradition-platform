from fastapi import APIRouter

from .courses import router as courses_router
from .enrollments import router as enrollments_router

router = APIRouter()
router.include_router(courses_router)
router.include_router(enrollments_router)

__all__ = ["router"]
