"""Seating a bout's winner in the next round, and closing out walkovers.

Split out of ``bracket_service.py``'s "advancement" section. Self-contained
by design: nothing here calls back into :mod:`bracket_service` or
:mod:`withdrawal_service`, so those two both depend on this module and never
the other way around.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import CompetitionEvent, Match, MatchResult, Participant, Tournament
from app.modules.tournaments.services.bracket_common import (
    OUT_STATUSES,
    PENDING_STATUSES,
    WALKOVER_RESULT_TYPE,
    ready_status,
)


class AdvancementService:
    @staticmethod
    async def advance_winner(session: AsyncSession, match: Match) -> Match | None:
        """Seat ``match``'s winner in the next round.

        Called from exactly two places — a resolved bye and a completed bout —
        so there is one code path, and the bracket is always reconstructible
        from the database alone.
        """
        if match.next_match_id is None or match.winner_id is None:
            return None
        target = await session.get(Match, match.next_match_id)
        if target is None:
            return None

        if match.next_slot == "BLUE":
            target.participant_blue_id = match.winner_id
        else:
            target.participant_red_id = match.winner_id

        if (
            target.participant_red_id is not None
            and target.participant_blue_id is not None
            and target.status in PENDING_STATUSES
        ):
            target.status = ready_status(target)

        if match.competition_id is not None:
            session.add(
                CompetitionEvent(
                    competition_id=match.competition_id,
                    event_type="PARTICIPANT_ADVANCED",
                    description=f"Победитель вышел в {target.stage_name or 'следующий круг'}",
                    payload={
                        "from_match_id": str(match.id),
                        "to_match_id": str(target.id),
                        "slot": match.next_slot or "RED",
                        "participant_id": str(match.winner_id),
                        "to_stage": target.stage_name,
                    },
                )
            )
        await session.flush()
        await AdvancementService._walkover_if_opponent_out(session, target)
        return target

    @staticmethod
    async def _walkover_if_opponent_out(session: AsyncSession, target: Match) -> None:
        """Close ``target`` when the fighter already sitting in it has withdrawn.

        Withdrawing only settles the bouts a fighter is *currently* seated in.
        Someone who pulls out of a quarterfinal before the other half of the draw
        has produced their opponent leaves a match that cannot be settled yet —
        there is nobody to award it to. So the check runs again here, the moment
        a winner is seated opposite them, and the newcomer walks through.
        Recursion is bounded by the tree: each step moves one round closer to the
        final.
        """
        if target.is_bye or target.status not in PENDING_STATUSES:
            return
        red, blue = target.participant_red_id, target.participant_blue_id
        if red is None or blue is None:
            return

        rows = {
            p.id: p
            for p in await session.scalars(select(Participant).where(Participant.id.in_([red, blue])))
        }
        red_out = red in rows and rows[red].status in OUT_STATUSES
        blue_out = blue in rows and rows[blue].status in OUT_STATUSES
        # Both gone is not a walkover: there is no winner to name, and inventing
        # one would put a fighter in the next round who never fought for it.
        if red_out == blue_out:
            return

        loser = rows[red] if red_out else rows[blue]
        await AdvancementService._record_walkover(
            session,
            target,
            winner_id=blue if red_out else red,
            loser=loser,
            reason=f"Соперник выбыл ({loser.status})",
        )

    @staticmethod
    async def _record_walkover(
        session: AsyncSession,
        match: Match,
        *,
        winner_id: UUID,
        loser: Participant,
        reason: str,
    ) -> None:
        """Award an unfought bout to ``winner_id`` and push them onward.

        Writes a real :class:`MatchResult` rather than a special case, so a
        walkover reads back through every existing projection — standings, the
        journal, the champion's path — as the recorded decision it is. Never
        touches a bout that already carries a result.
        """
        existing = await session.scalar(select(MatchResult).where(MatchResult.match_id == match.id))
        if existing is not None:
            return

        result_type = WALKOVER_RESULT_TYPE.get(loser.status, "WITHDRAWAL")
        session.add(
            MatchResult(
                match_id=match.id,
                winner_participant_id=winner_id,
                result_type=result_type,
                notes=reason,
                recorded_at=datetime.now(timezone.utc),
            )
        )
        match.status = "FINISHED"
        match.winner_id = winner_id
        if match.competition_id is not None:
            session.add(
                CompetitionEvent(
                    competition_id=match.competition_id,
                    event_type="WALKOVER_GRANTED",
                    description=f"Проход без боя: соперник выбыл ({loser.status})",
                    payload={
                        "match_id": str(match.id),
                        "stage": match.stage_name,
                        "winner_id": str(winner_id),
                        "withdrawn_participant_id": str(loser.id),
                        "result_type": result_type,
                        "reason": reason,
                    },
                )
            )
        await session.flush()
        await AdvancementService.advance_winner(session, match)
        await AdvancementService.sync_tournament_state(session, match)

    @staticmethod
    async def sync_tournament_state(session: AsyncSession, match: Match) -> None:
        """Nudge the tournament state machine after a bout changes.

        Deliberately monotonic: it only ever moves the tournament forward, so a
        late correction to an early bout can never drag a finished event back to
        "in progress".
        """
        tournament = await session.get(Tournament, match.tournament_id)
        if tournament is None:
            return

        order = ["DRAFT", "REGISTRATION", "READY", "BRACKET_CREATED", "RUNNING", "FINAL", "FINISHED"]

        def advance_to(target: str) -> None:
            if tournament.status not in order:
                return
            if order.index(target) > order.index(tournament.status):
                tournament.status = target

        if match.is_final:
            if match.status == "FINISHED":
                advance_to("FINISHED")
            elif match.status in {"IN_PROGRESS", "READY"}:
                advance_to("FINAL")
        elif match.status in {"IN_PROGRESS", "FINISHED"}:
            advance_to("RUNNING")
