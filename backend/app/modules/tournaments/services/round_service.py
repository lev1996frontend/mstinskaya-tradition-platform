"""The соступ (round) lifecycle and win-condition evaluation.

Split out of ``bout_service.py``'s "соступ" and "win-condition evaluation"
sections. Depends on :class:`BoutService` for match/round lookups, weapon
resolution and event logging, and on
:class:`app.modules.tournaments.services.bracket_service.BracketService` to
seat the winner once a поединок is decided — the same two calls
``bout_service.py`` itself used to make directly.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import rules
from app.modules.tournaments.models import Match, MatchResult, MatchRound, RoundScore
from app.modules.tournaments.services.bracket_service import BracketService, parse_id
from app.modules.tournaments.services.bout_service import BoutService


def _side_of(match: Match, participant_id: UUID) -> str | None:
    if match.participant_red_id == participant_id:
        return "RED"
    if match.participant_blue_id == participant_id:
        return "BLUE"
    return None


class RoundService:
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
        round_row = await RoundService._get_open_round(session, match, round_number)

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
            await RoundService._close_round(session, match, round_row, scorer_id, "DISARM")
            await RoundService._complete_bout(
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
            await RoundService._close_round(session, match, round_row, scorer_id, end_reason)
            await RoundService._evaluate_bout(session, match, actor_id=actor_id)

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
        round_row = await RoundService._get_open_round(session, match, round_number)

        winner_id = parse_id(winner_participant_id, "participant")
        if _side_of(match, winner_id) is None:
            raise HTTPException(status_code=400, detail="That participant is not in this bout")

        round_row.notes = notes
        await RoundService._close_round(session, match, round_row, winner_id, end_reason)
        await RoundService._evaluate_bout(session, match, actor_id=actor_id)
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
        await RoundService._complete_bout(
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
