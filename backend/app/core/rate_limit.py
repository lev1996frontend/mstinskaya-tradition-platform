"""Per-IP request throttling.

In-memory only: a single-process limit, reset on restart, and not shared
across workers if this ever runs behind more than one. That is a real
limitation for a multi-worker deployment, but it is still strictly better
than the no limit at all `/api/v1/auth/*` had before — credential stuffing
and registration spam had nothing slowing them down. Move the backend to
`slowapi`'s Redis storage (`storage_uri="redis://..."`) if this ever runs
with more than one worker.
"""

from __future__ import annotations

import sys

from slowapi import Limiter
from slowapi.util import get_remote_address

#: The whole suite runs as one long-lived process sharing this one `Limiter`,
#: and most test files log in or register at least once — a limit tight
#: enough to matter for a real login form would trip on its own test
#: fixtures long before it started asserting anything. Checking for the
#: `pytest` module rather than the `PYTEST_CURRENT_TEST` env var: most test
#: files import `app.main` (and so this module) at collection time, before
#: any individual test has started and set that variable, but `pytest` is
#: already in `sys.modules` by then.
limiter = Limiter(key_func=get_remote_address, enabled="pytest" not in sys.modules)
