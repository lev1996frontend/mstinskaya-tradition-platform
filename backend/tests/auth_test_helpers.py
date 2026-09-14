"""Shared helpers for switching which registered identity a `TestClient`
session's cookies authenticate as.

Login/register/refresh no longer put a token anywhere a test can read out of
the JSON body (see ``app/modules/auth/router.py``) — the session lives
entirely in the client's cookie jar. A test that needs to act as more than
one identity on one `TestClient` instance (an organizer, then a stranger,
say) used to grab each one's Bearer token from the registration response and
pass it as an explicit header per call; there is no token to grab anymore,
so these two functions capture/restore the jar instead.

``use_session`` overwrites *existing* jar entries in place rather than
adding new ones: a freshly-added cookie would need a domain to match
requests against, and ``TestClient`` picks one (``testserver.local``, not
the ``testserver`` its own ``base_url`` reports) that is not worth relying
on from test code. The entries this mutates were always set by a real
``Set-Cookie`` response, so they already carry the domain/path the server
actually used.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def snapshot_session(client: TestClient) -> dict[str, str]:
    """Capture the identity `client` is currently authenticated as, to
    switch back to it later after acting as someone else. Call this right
    after that identity's own register/login/refresh call."""
    return {cookie.name: cookie.value for cookie in client.cookies.jar}


def use_session(client: TestClient, session: dict[str, str]) -> None:
    """Make `client` authenticate as the identity `session` was captured
    from. Requires that identity's cookies to have already passed through
    this client's jar at least once — true for anything `snapshot_session`
    was itself called on."""
    for cookie in client.cookies.jar:
        if cookie.name in session:
            cookie.value = session[cookie.name]
