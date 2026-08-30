"""The поединок: lot draw, соступ lifecycle, and the win-condition engine.

Every transition here is enforced server-side. Hiding a button is never the
mechanism — a request that violates the state machine is rejected with a status
code, whether or not any UI would have offered it.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import rules
from app.modules.tournaments.models import (
    CompetitionEvent,
    Match,
    MatchLot,
    MatchResult,
    MatchRound,
    Participant,
    RoundScore,
)
from app.modules.tournaments.services.bracket_service import BracketService, parse_id

#: Bout statuses from which a lot may still be drawn.
LOTTABLE_STATUSES: frozenset[str] = frozenset({"SCHEDULED", "READY_FOR_LOT"})

SIDES = ("RED", "BLUE")


def _side_of(match: Match, participant_id: UUID) -> str | None:
    if match.participant_red_id == participant_id:
        return "RED"
    if match.participant_blue_id == participant_id:
        return "BLUE"
    return None


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
    # жребий
    # ------------------------------------------------------------------ #

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
        BoutService._guard_lot_allowed(match)

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
            face = BoutService._roll_online()

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
        await BoutService._settle_lot_state(session, match)
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
            face = BoutService._roll_online()
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
        await BoutService._settle_lot_state(session, match)
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
    # соступ
    # ------------------------------------------------------------------ #

    @staticmethod
    async def open_round(session: AsyncSession, match_id: str, *, actor_id: UUID | None = None) -> MatchRound:
        """Open the next соступ of a running поединок."""
        match = await BoutService.get_match(session, match_id)
        if match.status != "IN_PROGRESS":
            raise HTTPException(status_code=409, detail="The bout is not running")

        existing = await BoutService.rounds_of(session, match.id)
        if any(r.status == "IN_PROGRESS" for r in existing):
            raise HTTPException(status_code=409, detail="Finish the current соступ first")
        if len(existing) >= rules.MAX_ROUNDS_PER_BOUT:
            raise HTTPException(
                status_code=409,
                detail=f"A поединок is at most {rules.MAX_ROUNDS_PER_BOUT} соступ",
            )

        round_row = MatchRound(match_id=match.id, round_number=len(existing) + 1, status="IN_PROGRESS")
        session.add(round_row)
        BoutService._log(
            session,
            match,
            "ROUND_STARTED",
            f"Начат соступ {round_row.round_number}",
            {"round_number": round_row.round_number, "actor_id": str(actor_id) if actor_id else None},
        )
        await session.flush()
        return round_row

    @staticmethod
    async def _get_open_round(session: AsyncSession, match: Match, round_number: int) -> MatchRound:
        round_row = await session.scalar(
            select(MatchRound).where(
                MatchRound.match_id == match.id, MatchRound.round_number == round_number
            )
        )
        if round_row is None:
            raise HTTPException(status_code=404, detail="Соступ not found")
        if round_row.status != "IN_PROGRESS":
            raise HTTPException(status_code=409, detail="This соступ is already finished")
        return round_row

    @staticmethod
    async def record_score(
        session: AsyncSession,
        match_id: str,
        round_number: int,
        *,
        participant_id: str,
        action_code: str,
        actor_id: UUID | None = None,
    ) -> MatchRound:
        """Credit one scoring action, then apply the соступ and bout rules."""
        match = await BoutService.get_match(session, match_id)
        if match.status != "IN_PROGRESS":
            raise HTTPException(status_code=409, detail="The bout is not running")
        round_row = await BoutService._get_open_round(session, match, round_number)

        scorer_id = parse_id(participant_id, "participant")
        side = _side_of(match, scorer_id)
        if side is None:
            raise HTTPException(status_code=400, detail="That participant is not in this bout")

        weapon = await BoutService.weapon_of_side(session, match, side)
        if weapon is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No weapon is on record for this side, so point tiers cannot be applied. "
                    "Close the соступ with an explicit judge decision instead."
                ),
            )

        try:
            action = rules.validate_action_for_weapon(action_code, weapon)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None

        session.add(
            RoundScore(
                round_id=round_row.id,
                participant_id=scorer_id,
                action_code=action.code,
                weapon=weapon,
                points=action.points,
                recorded_by_user_id=actor_id,
            )
        )

        if action.points is not None:
            if side == "RED":
                round_row.points_red += action.points
            else:
                round_row.points_blue += action.points

        scored = round_row.points_red if side == "RED" else round_row.points_blue
        BoutService._log(
            session,
            match,
            "ROUND_SCORED",
            f"{action.label_ru} — соступ {round_number}",
            {
                "round_number": round_number,
                "participant_id": str(scorer_id),
                "side": side,
                "action_code": action.code,
                "weapon": weapon,
                "points": action.points,
                "points_red": round_row.points_red,
                "points_blue": round_row.points_blue,
            },
        )

        if action.ends_bout:
            # The unarmed fighter's disarm decides the whole поединок, not just
            # this соступ — the single most distinctive rule of the tradition.
            await BoutService._close_round(session, match, round_row, scorer_id, "DISARM")
            await BoutService._complete_bout(
                session, match, winner_id=scorer_id, result_type="DISARM", actor_id=actor_id
            )
            await session.flush()
            return round_row

        if action.ends_round or scored >= rules.ROUND_TARGET_POINTS:
            end_reason = (
                "KISTEN_CLEAN"
                if weapon == rules.KISTEN
                else ("CLEAN_HIT" if action.ends_round else "POINTS")
            )
            await BoutService._close_round(session, match, round_row, scorer_id, end_reason)
            await BoutService._evaluate_bout(session, match, actor_id=actor_id)

        await session.flush()
        return round_row

    @staticmethod
    async def complete_round(
        session: AsyncSession,
        match_id: str,
        round_number: int,
        *,
        winner_participant_id: str,
        end_reason: str = "JUDGE_DECISION",
        notes: str | None = None,
        actor_id: UUID | None = None,
    ) -> MatchRound:
        """Close a соступ by explicit judge call (withdrawal, кистень, etc.)."""
        match = await BoutService.get_match(session, match_id)
        if match.status != "IN_PROGRESS":
            raise HTTPException(status_code=409, detail="The bout is not running")
        round_row = await BoutService._get_open_round(session, match, round_number)

        winner_id = parse_id(winner_participant_id, "participant")
        if _side_of(match, winner_id) is None:
            raise HTTPException(status_code=400, detail="That participant is not in this bout")

        round_row.notes = notes
        await BoutService._close_round(session, match, round_row, winner_id, end_reason)
        await BoutService._evaluate_bout(session, match, actor_id=actor_id)
        await session.flush()
        return round_row

    @staticmethod
    async def _close_round(
        session: AsyncSession, match: Match, round_row: MatchRound, winner_id: UUID, end_reason: str
    ) -> None:
        round_row.status = "COMPLETED"
        round_row.winner_participant_id = winner_id
        round_row.end_reason = end_reason
        round_row.completed_at = datetime.now(timezone.utc)
        BoutService._log(
            session,
            match,
            "ROUND_COMPLETED",
            f"Соступ {round_row.round_number} выигран",
            {
                "round_number": round_row.round_number,
                "winner_id": str(winner_id),
                "end_reason": end_reason,
                "points_red": round_row.points_red,
                "points_blue": round_row.points_blue,
            },
        )
        await session.flush()

    # ------------------------------------------------------------------ #
    # win-condition evaluation
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _evaluate_bout(session: AsyncSession, match: Match, *, actor_id: UUID | None) -> None:
        """Finish the поединок once all соступ are played.

        CLIENT CORRECTION: all `rules.MAX_ROUNDS_PER_BOUT` соступ are always
        fought, even once a side has mathematically clinched the win-condition
        threshold — so this only decides *who* won, never *whether it's over
        early*. A disarm is the one exception, and it never reaches this
        function: it ends the поединок immediately from `record_score`'s
        `action.ends_bout` branch, before `_evaluate_bout` is ever called.
        """
        rounds = await BoutService.rounds_of(session, match.id)
        completed = [r for r in rounds if r.status == "COMPLETED"]
        if len(completed) < rules.MAX_ROUNDS_PER_BOUT:
            return
        wins_red = sum(1 for r in completed if r.winner_participant_id == match.participant_red_id)
        wins_blue = sum(1 for r in completed if r.winner_participant_id == match.participant_blue_id)

        condition = rules.WinCondition(
            required_a=match.required_rounds_red or 2,
            required_b=match.required_rounds_blue or 2,
            asymmetric=(match.required_rounds_red != match.required_rounds_blue),
            explanation_ru="",
        )
        side = rules.bout_winner_side(wins_red, wins_blue, condition)
        if side is None:
            # Defensive: with every соступ played, a majority always exists
            # (HANDS carries no round-winnable scoring action of its own, so
            # the asymmetric case can only ever resolve 3-0 or end earlier via
            # disarm; the symmetric case can only ever resolve 2-1 or 3-0).
            side = "A" if wins_red >= wins_blue else "B"

        # ``bout_winner_side`` speaks in A/B (the win condition's own two sides),
        # which map to red and blue in that order.
        winner_id = match.participant_red_id if side == "A" else match.participant_blue_id
        if winner_id is None:
            return
        await BoutService._complete_bout(
            session, match, winner_id=winner_id, result_type="ROUND_WINS", actor_id=actor_id
        )

    @staticmethod
    async def _complete_bout(
        session: AsyncSession,
        match: Match,
        *,
        winner_id: UUID,
        result_type: str,
        actor_id: UUID | None,
    ) -> None:
        existing = await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id))
        if existing is None:
            session.add(
                MatchResult(
                    match_id=match.id,
                    winner_participant_id=winner_id,
                    result_type=result_type,
                    notes=None,
                )
            )
        match.status = "FINISHED"
        match.winner_id = winner_id

        rounds = await BoutService.rounds_of(session, match.id)
        BoutService._log(
            session,
            match,
            "BOUT_COMPLETED",
            "Поединок завершён",
            {
                "winner_id": str(winner_id),
                "result_type": result_type,
                "rounds": [
                    {
                        "round_number": r.round_number,
                        "winner_id": str(r.winner_participant_id) if r.winner_participant_id else None,
                        "points_red": r.points_red,
                        "points_blue": r.points_blue,
                        "end_reason": r.end_reason,
                    }
                    for r in rounds
                ],
                "actor_id": str(actor_id) if actor_id else None,
            },
        )
        BoutService._log(
            session, match, "WINNER_DECLARED", "Объявлен победитель", {"winner_id": str(winner_id)}
        )
        await session.flush()

        # One code path moves a fighter into the next round, and it is this one.
        await BracketService.advance_winner(session, match)
        await BracketService.sync_tournament_state(session, match)
        if match.team_bout_id is not None:
            from app.modules.tournaments.services.team_bout_service import TeamBoutService

            await TeamBoutService.recompute(session, match.team_bout_id)
        await session.flush()

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
