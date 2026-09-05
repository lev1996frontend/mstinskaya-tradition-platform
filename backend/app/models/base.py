from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    #: Every ``Mapped[datetime]`` in the project means an instant, not a wall
    #: clock reading: the models write ``datetime.now(timezone.utc)`` and
    #: nothing anywhere writes a naive one. Declared here once rather than on
    #: each of the ~150 timestamp columns, so a new model cannot forget it.
    #:
    #: Without this the annotation maps to a bare ``DateTime`` — Postgres
    #: ``timestamp without time zone`` — and an aware value handed to such a
    #: column silently loses its offset, landing as whatever the session's
    #: TimeZone made of it. SQLite, which the tests run on, has no such
    #: distinction and would never show the difference.
    type_annotation_map = {datetime: DateTime(timezone=True)}
