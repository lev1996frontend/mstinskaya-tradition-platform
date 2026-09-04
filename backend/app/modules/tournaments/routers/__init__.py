"""Tournament routers.

The routers are exported separately and mounted side by side in ``app.main``.
Nesting them would prepend the ``/api/v1/tournaments`` prefix to the engine,
read and bout routes, which already carry their own ``/api/v1`` prefix.
"""

from .tournaments import router
from .bouts import router as bout_router
from .engine import router as engine_router
from .intake import router as intake_router
from .read import router as read_router

__all__ = ["router", "engine_router", "read_router", "bout_router", "intake_router"]
