"""Constants and tiny helpers shared by every bracket-lifecycle service.

Split out of what used to be one 1236-line ``bracket_service.py`` so the
three concerns that file mixed together — building the tree
(:mod:`bracket_service`), seating winners
(:mod:`advancement_service`), and pulling a fighter back out of it
(:mod:`withdrawal_service`) — could live in their own modules without an
import cycle: all three depend on these constants, none of them depend on
each other's private helpers, so this module depends on nothing but the
standard library and stays a leaf every other bracket module can import.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.modules.tournaments.models import Match

#: Statuses a bout can hold. ``FINISHED`` is the persisted spelling of the
#: spec's ``COMPLETED``; it predates this work and is kept so the existing API
#: keeps its meaning.
BOUT_STATUSES: frozenset[str] = frozenset(
    {"SCHEDULED", "READY_FOR_LOT", "LOT_COMPLETED", "READY", "IN_PROGRESS", "FINISHED", "CANCELLED"}
)

#: Bouts that have not started and can still accept an incoming fighter.
PENDING_STATUSES: frozenset[str] = frozenset({"SCHEDULED", "READY_FOR_LOT", "READY"})

#: A fighter who is out of the draw. Both spellings behave identically for the
#: bracket; only the recorded reason differs.
OUT_STATUSES: frozenset[str] = frozenset({"WITHDRAWN", "DISQUALIFIED"})

#: A named reserve. Deliberately *not* folded into :data:`OUT_STATUSES`: those
#: mean "left", and a bout against someone who left is awarded as a walkover.
#: A reserve has not left, they have not yet entered — nobody is ever seated
#: opposite them, so there is nothing to award.
RESERVE_STATUS = "RESERVE"

#: Everyone the draw skips over, for whichever of the two reasons.
NOT_IN_DRAW_STATUSES: frozenset[str] = OUT_STATUSES | {RESERVE_STATUS}

#: A bout that has already been drawn for or started belongs to the judge until
#: it is finished or cancelled. Withdrawing out from under it would overwrite a
#: lot that was really thrown, so it is refused instead.
IN_FLIGHT_STATUSES: frozenset[str] = frozenset({"LOT_COMPLETED", "IN_PROGRESS"})

#: How a walkover is recorded, per the reason the fighter left.
WALKOVER_RESULT_TYPE: dict[str, str] = {
    "WITHDRAWN": "WITHDRAWAL",
    "DISQUALIFIED": "DISQUALIFICATION",
}

TOURNAMENT_STATUS_BRACKET_CREATED = "BRACKET_CREATED"


def parse_id(value: str, label: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} id") from None


def ready_status(match: Match) -> str:
    """The "waiting to start" status for this bout.

    A final skips the lot states entirely, so it goes straight to ``READY``.
    """
    return "READY" if match.is_final else "READY_FOR_LOT"
