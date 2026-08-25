from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/identity", tags=["identity"])

__all__ = ["router"]
