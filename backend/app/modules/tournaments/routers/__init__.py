from .tournaments import router
from .engine import router as engine_router

router.include_router(engine_router)

__all__ = ["router"]
