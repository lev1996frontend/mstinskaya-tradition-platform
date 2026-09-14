"""Identity domain package.

Read-only from every other module's point of view (``docs/clubs-domain.md``
rule 5): it holds the ``User``/``Role``/``Profile`` models and the auth
logic that operates on them (password hashing, registration, the ``/users/
me`` projection), but has no route of its own — ``app.modules.auth`` owns
``/api/v1/auth/*`` and ``/api/v1/users/me``, calling into this module's
services rather than duplicating them.
"""

__all__ = ["models", "schemas", "services"]
