"""Rule engine and seeding algorithms for the tournament domain.

Pure logic, deliberately free of SQLAlchemy and FastAPI so it can be reasoned
about (and tested) without a database.
"""

from . import bracket, rules

__all__ = ["bracket", "rules"]
