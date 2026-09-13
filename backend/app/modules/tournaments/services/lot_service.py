"""The жребий (weapon lot draw) and its correction.

Split out of ``bout_service.py``'s "жребий" section. Depends on
:class:`BoutService` for its match lookup, current-lot read and event
logging — the same three helpers :mod:`round_service` also shares — but
nothing here is called back from either of those.
"""

from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import rules
from app.modules.tournaments.models import Match, MatchLot
from app.modules.tournaments.services.bout_service import BoutService

#: Bout statuses from which a lot may still be drawn.
LOTTABLE_STATUSES: frozenset[str] = frozenset({"SCHEDULED", "READY_FOR_LOT"})

SIDES = ("RED", "BLUE")


class LotService:
    @staticmethod
    def _roll_online() -> int:
        """A real, non-guessable roll.

        ``secrets`` rather than ``random`` because this value decides a
        competitive outcome. The browser never computes it — it asks for a lot
        and receives one that is already fixed and already persisted.
        """
        return secrets.randbelow(rules.DIE_SIDES) + 1

    @staticmethod
    def _guard_lot_allowed(match: Match) -> None:
        if match.is_final:
            raise HTTPException(
                status_code=400,
                detail="No lot is drawn for a final bout — its weapons are fixed by the tournament rules",
            )
        if match.is_bye:
            raise HTTPException(status_code=400, detail="A bye has no lot")
        if match.team_bout_id is not None:
            # «Трое на трое» is decided by a pin and a signalled finishing blow,
            # not by a weapon draw — see ``team_bout_service``.
            raise HTTPException(status_code=400, detail="Team pairings do not draw a weapon lot")
        if match.participant_red_id is None or match.participant_blue_id is None:
            raise HTTPException(status_code=400, detail="Both fighters must be seated before the lot")
        if match.status not in LOTTABLE_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot draw a lot for a bout in status {match.status}",
            )

    @staticmethod
    async def draw_lot(
        session: AsyncSession,
        match_id: str,
        *,
        side: str,
        method: str,
        die_value: int | None = None,
        actor_id: UUID | None = None,
    ) -> MatchLot:
        match = await BoutService.get_match(session, match_id)
        LotService._guard_lot_allowed(match)

        side = side.upper()
        if side not in SIDES:
            raise HTTPException(status_code=400, detail="Side must be RED or BLUE")
        if method not in rules.LOT_METHODS:
            raise HTTPException(status_code=400, detail="Unknown lot method")

        existing = await BoutService.current_lots(session, match.id)
        if side in existing:
            # Second draw on the same side: refused by the backend, not merely
            # hidden. Corrections go through ``override_lot``.
            raise HTTPException(status_code=409, detail=f"Side {side} has already drawn its lot")

        if method == rules.LOT_METHOD_PHYSICAL:
            if die_value is None:
                raise HTTPException(status_code=400, detail="A physical roll needs the die face value")
            face = int(die_value)
        else:
            face = LotService._roll_online()

        try:
            weapon = rules.weapon_for_die_face(face)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None

        lot = MatchLot(
            match_id=match.id,
            side=side,
            sequence=1,
            is_current=True,
            participant_id=match.participant_red_id if side == "RED" else match.participant_blue_id,
            method=method,
            die_value=face,
            weapon=weapon,
            drawn_by_user_id=actor_id,
        )
        session.add(lot)
        BoutService._log(
            session,
            match,
            "LOT_DRAWN",
            f"Жребий {side}: {rules.WEAPON_LABELS_RU.get(weapon, weapon)}",
            {
                "side": side,
                "method": method,
                "die_value": face,
                "weapon": weapon,
                "actor_id": str(actor_id) if actor_id else None,
            },
        )
        await session.flush()
        await LotService._settle_lot_state(session, match)
        await session.flush()
        return lot

    @staticmethod
    async def override_lot(
        session: AsyncSession,
        match_id: str,
        *,
        side: str,
        method: str,
        reason: str,
        die_value: int | None = None,
        actor_id: UUID | None = None,
    ) -> MatchLot:
        """Admin correction of a drawn lot: supersede, never overwrite.

        The previous draw keeps its row and its ``sequence``; a new current row
        is appended, and both the old and the new values go into the journal.
        """
        match = await BoutService.get_match(session, match_id)
        if match.is_final:
            raise HTTPException(status_code=400, detail="A final bout has no lot to correct")
        if match.status == "FINISHED":
            raise HTTPException(
                status_code=409,
                detail="The bout is finished; correct the result instead of the lot",
            )
        if not reason or not reason.strip():
            raise HTTPException(status_code=400, detail="An override needs a reason")

        side = side.upper()
        if side not in SIDES:
            raise HTTPException(status_code=400, detail="Side must be RED or BLUE")
        if method not in rules.LOT_METHODS:
            raise HTTPException(status_code=400, detail="Unknown lot method")

        current = (await BoutService.current_lots(session, match.id)).get(side)
        if current is None:
            raise HTTPException(status_code=404, detail=f"Side {side} has no lot to correct")

        if method == rules.LOT_METHOD_PHYSICAL:
            if die_value is None:
                raise HTTPException(status_code=400, detail="A physical roll needs the die face value")
            face = int(die_value)
        else:
            face = LotService._roll_online()
        try:
            weapon = rules.weapon_for_die_face(face)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None

        previous = {
            "lot_id": str(current.id),
            "method": current.method,
            "die_value": current.die_value,
            "weapon": current.weapon,
            "sequence": current.sequence,
        }
        current.is_current = False

        replacement = MatchLot(
            match_id=match.id,
            side=side,
            sequence=current.sequence + 1,
            is_current=True,
            participant_id=current.participant_id,
            method=method,
            die_value=face,
            weapon=weapon,
            drawn_by_user_id=actor_id,
            override_reason=reason.strip(),
        )
        session.add(replacement)
        BoutService._log(
            session,
            match,
            "LOT_OVERRIDDEN",
            reason.strip(),
            {
                "side": side,
                "previous": previous,
                "new": {"method": method, "die_value": face, "weapon": weapon},
                "reason": reason.strip(),
                "actor_id": str(actor_id) if actor_id else None,
            },
        )
        await session.flush()
        await LotService._settle_lot_state(session, match)
        await session.flush()
        return replacement

    @staticmethod
    async def _settle_lot_state(session: AsyncSession, match: Match) -> None:
        """Once both sides have drawn, freeze the matchup's win condition."""
        lots = await BoutService.current_lots(session, match.id)
        if not all(side in lots for side in SIDES):
            return
        condition = rules.win_condition(lots["RED"].weapon, lots["BLUE"].weapon)
        match.required_rounds_red = condition.required_a
        match.required_rounds_blue = condition.required_b
        if match.status in LOTTABLE_STATUSES:
            match.status = "LOT_COMPLETED"
            BoutService._log(
                session,
                match,
                "LOT_COMPLETED",
                "Жребий проведён для обеих сторон",
                {
                    "weapon_red": lots["RED"].weapon,
                    "weapon_blue": lots["BLUE"].weapon,
                    "required_rounds_red": condition.required_a,
                    "required_rounds_blue": condition.required_b,
                    "explanation": condition.explanation_ru,
                },
            )
