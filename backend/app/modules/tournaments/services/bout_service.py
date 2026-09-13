"""The поединок: lookups, lifecycle, and the detail projection.

Every transition here is enforced server-side. Hiding a button is never the
mechanism — a request that violates the state machine is rejected with a status
code, whether or not any UI would have offered it.

Two concerns that used to live in this same 736-line file now have their own
modules instead:

* :mod:`lot_service` (``LotService``) — drawing and correcting the жребий
  (weapon lot).
* :mod:`round_service` (``RoundService``) — the соступ (round) lifecycle and
  win-condition evaluation that decides when a поединок is finished.

Both depend on this module for match/round lookups and event logging
(``get_match``, ``current_lots``, ``rounds_of``, ``weapon_of_side``,
``_log``), so those stay here; nothing here depends on either of them at
import time. :class:`BoutService` keeps thin facade methods (``draw_lot``,
``override_lot``, ``open_round``, ``record_score``, ``complete_round``)
forwarding to whichever module now owns the logic, so the router
(``routers/bouts.py``) needed no changes.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import rules
from app.modules.tournaments.models import (
    CompetitionEvent,
    Match,
    MatchLot,
    MatchRound,
    RoundScore,
)
from app.modules.tournaments.services.bracket_service import BracketService, parse_id

__all__ = ["BoutService", "parse_id"]


class BoutService:
    # ------------------------------------------------------------------ #
    # lookups
    # ------------------------------------------------------------------ #

    @staticmethod
    async def get_match(session: AsyncSession, match_id: str) -> Match:
        match = await session.get(Match, parse_id(match_id, "match"))
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        return match

    @staticmethod
    async def current_lots(session: AsyncSession, match_id: UUID) -> dict[str, MatchLot]:
        rows = await session.scalars(
            select(MatchLot).where(MatchLot.match_id == match_id, MatchLot.is_current.is_(True))
        )
        return {lot.side: lot for lot in rows}

    @staticmethod
    async def rounds_of(session: AsyncSession, match_id: UUID) -> list[MatchRound]:
        return list(
            await session.scalars(
                select(MatchRound).where(MatchRound.match_id == match_id).order_by(MatchRound.round_number.asc())
            )
        )

    @staticmethod
    async def weapon_of_side(session: AsyncSession, match: Match, side: str) -> str | None:
        """The weapon a side fights with: the drawn lot, or the final's fixed one."""
        if match.is_final:
            return match.final_weapon
        lots = await BoutService.current_lots(session, match.id)
        lot = lots.get(side)
        return lot.weapon if lot else None

    @staticmethod
    def _log(session: AsyncSession, match: Match, event_type: str, description: str, payload: dict) -> None:
        if match.competition_id is None:
            return
        session.add(
            CompetitionEvent(
                competition_id=match.competition_id,
                event_type=event_type,
                description=description,
                payload={"match_id": str(match.id), **payload},
            )
        )

    # ------------------------------------------------------------------ #
    # bout lifecycle
    # ------------------------------------------------------------------ #

    @staticmethod
    async def start_bout(session: AsyncSession, match_id: str, *, actor_id: UUID | None = None) -> Match:
        match = await BoutService.get_match(session, match_id)
        if match.is_bye:
            raise HTTPException(status_code=400, detail="A bye is not fought")
        if match.participant_red_id is None or match.participant_blue_id is None:
            raise HTTPException(status_code=400, detail="Both fighters must be seated before the bout starts")
        if match.status == "IN_PROGRESS":
            raise HTTPException(status_code=409, detail="The bout has already started")
        if match.status in {"FINISHED", "CANCELLED"}:
            raise HTTPException(status_code=409, detail=f"The bout is {match.status}")
        if match.is_final or match.team_bout_id is not None:
            # Neither draws a lot, so neither passes through LOT_COMPLETED.
            if match.status not in {"READY", "SCHEDULED"}:
                raise HTTPException(status_code=409, detail=f"Cannot start this bout in status {match.status}")
        elif match.status != "LOT_COMPLETED":
            raise HTTPException(status_code=409, detail="Draw the lot for both sides before starting the bout")

        if match.is_final and (match.required_rounds_red is None or match.required_rounds_blue is None):
            # A final's weapons are fixed by the tournament rules rather than
            # drawn. When the organizer named one it applies to both fighters;
            # when they left it open the symmetric best-of-three applies.
            weapon = match.final_weapon or rules.PALKA
            condition = rules.win_condition(weapon, weapon)
            match.required_rounds_red = condition.required_a
            match.required_rounds_blue = condition.required_b

        match.status = "IN_PROGRESS"
        BoutService._log(
            session,
            match,
            "BOUT_STARTED",
            f"Начат поединок ({match.stage_name or 'бой'})",
            {"stage": match.stage_name, "actor_id": str(actor_id) if actor_id else None},
        )
        if match.is_final:
            BoutService._log(session, match, "FINAL_STARTED", "Начат финальный поединок", {})
        await BracketService.sync_tournament_state(session, match)
        await session.flush()
        return match

    # ------------------------------------------------------------------ #
    # facade: жребий / соступ
    # ------------------------------------------------------------------ #
    #
    # Forward to whichever module now owns the logic (see the module
    # docstring). Imports are function-local because lot_service and
    # round_service both import BoutService from here.

    @staticmethod
    async def draw_lot(session: AsyncSession, match_id: str, **kwargs) -> MatchLot:
        from app.modules.tournaments.services.lot_service import LotService

        return await LotService.draw_lot(session, match_id, **kwargs)

    @staticmethod
    async def override_lot(session: AsyncSession, match_id: str, **kwargs) -> MatchLot:
        from app.modules.tournaments.services.lot_service import LotService

        return await LotService.override_lot(session, match_id, **kwargs)

    @staticmethod
    async def open_round(session: AsyncSession, match_id: str, *, actor_id: UUID | None = None) -> MatchRound:
        from app.modules.tournaments.services.round_service import RoundService

        return await RoundService.open_round(session, match_id, actor_id=actor_id)

    @staticmethod
    async def record_score(session: AsyncSession, match_id: str, round_number: int, **kwargs) -> MatchRound:
        from app.modules.tournaments.services.round_service import RoundService

        return await RoundService.record_score(session, match_id, round_number, **kwargs)

    @staticmethod
    async def complete_round(session: AsyncSession, match_id: str, round_number: int, **kwargs) -> MatchRound:
        from app.modules.tournaments.services.round_service import RoundService

        return await RoundService.complete_round(session, match_id, round_number, **kwargs)

    # ------------------------------------------------------------------ #
    # detail projection
    # ------------------------------------------------------------------ #

    @staticmethod
    async def bout_detail(session: AsyncSession, match_id: str) -> dict:
        from app.modules.tournaments.services.read_service import TournamentReadService

        match = await BoutService.get_match(session, match_id)
        view = await TournamentReadService.match_detail(session, str(match.id))
        lots = await BoutService.current_lots(session, match.id)
        rounds = await BoutService.rounds_of(session, match.id)

        weapon_red = match.final_weapon if match.is_final else (lots["RED"].weapon if "RED" in lots else None)
        weapon_blue = match.final_weapon if match.is_final else (lots["BLUE"].weapon if "BLUE" in lots else None)

        condition_note = None
        if weapon_red and weapon_blue:
            condition_note = rules.win_condition(weapon_red, weapon_blue).explanation_ru

        scores_by_round: dict[UUID, list[RoundScore]] = {}
        if rounds:
            rows = await session.scalars(
                select(RoundScore)
                .where(RoundScore.round_id.in_([r.id for r in rounds]))
                .order_by(RoundScore.created_at.asc())
            )
            for row in rows:
                scores_by_round.setdefault(row.round_id, []).append(row)

        return {
            "match": view,
            "is_final": match.is_final,
            "is_bye": match.is_bye,
            "lot_required": not match.is_final and not match.is_bye,
            "weapon_red": weapon_red,
            "weapon_blue": weapon_blue,
            "required_rounds_red": match.required_rounds_red,
            "required_rounds_blue": match.required_rounds_blue,
            "win_condition_note": condition_note,
            "staging_note": rules.staging_note(weapon_red, weapon_blue)
            if weapon_red and weapon_blue
            else None,
            "lots": [
                {
                    "id": str(lot.id),
                    "side": lot.side,
                    "method": lot.method,
                    "die_value": lot.die_value,
                    "weapon": lot.weapon,
                    "sequence": lot.sequence,
                    "created_at": lot.created_at,
                }
                for lot in sorted(lots.values(), key=lambda item: item.side)
            ],
            "rounds": [
                {
                    "id": str(r.id),
                    "round_number": r.round_number,
                    "status": r.status,
                    "points_red": r.points_red,
                    "points_blue": r.points_blue,
                    "winner_id": str(r.winner_participant_id) if r.winner_participant_id else None,
                    "end_reason": r.end_reason,
                    "notes": r.notes,
                    "scores": [
                        {
                            "id": str(s.id),
                            "participant_id": str(s.participant_id),
                            "action_code": s.action_code,
                            "weapon": s.weapon,
                            "points": s.points,
                            "label": rules.SCORING_ACTIONS[s.action_code].label_ru
                            if s.action_code in rules.SCORING_ACTIONS
                            else s.action_code,
                        }
                        for s in scores_by_round.get(r.id, [])
                    ],
                }
                for r in rounds
            ],
            "rounds_won_red": sum(
                1
                for r in rounds
                if r.status == "COMPLETED" and r.winner_participant_id == match.participant_red_id
            ),
            "rounds_won_blue": sum(
                1
                for r in rounds
                if r.status == "COMPLETED" and r.winner_participant_id == match.participant_blue_id
            ),
            "max_rounds": rules.MAX_ROUNDS_PER_BOUT,
        }
