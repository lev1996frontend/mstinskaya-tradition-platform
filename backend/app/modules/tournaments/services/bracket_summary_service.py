"""The champion's run, read back from what was actually recorded.

Split out of ``bracket_service.py``'s "summary" section — a pure read that
only ever needed :meth:`BracketService._competition` from the generation
module and :class:`TournamentReadService` from the read side, never any of
the write logic in :mod:`advancement_service` or :mod:`withdrawal_service`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import Match, Participant
from app.modules.tournaments.services.bracket_service import BracketService


class BracketSummaryService:
    @staticmethod
    async def champion_summary(session: AsyncSession, competition_id: str) -> dict:
        """Everything that was actually recorded about the winner's run.

        Only real rows are read — no derived "statistics" that nobody entered.
        Returns ``complete: False`` while the final is still open.
        """
        from app.modules.tournaments.services.read_service import TournamentReadService

        competition = await BracketService._competition(session, competition_id)
        matches = list(
            await session.scalars(
                select(Match)
                .where(Match.competition_id == competition.id)
                .order_by(Match.round_number.asc().nulls_last(), Match.position.asc().nulls_last())
            )
        )
        final = next((m for m in matches if (m.stage_name or "").upper() == "FINAL"), None)
        if final is None or final.status != "FINISHED" or final.winner_id is None:
            return {"competition_id": str(competition.id), "complete": False, "champion": None, "path": []}

        participants = list(
            await session.scalars(select(Participant).where(Participant.competition_id == competition.id))
        )
        views = await TournamentReadService.build_participant_views(session, participants)
        by_id = {p.id: p for p in participants}

        champion_id = final.winner_id
        path: list[dict] = []
        for match in matches:
            if champion_id not in {match.participant_red_id, match.participant_blue_id}:
                continue
            opponent_id = (
                match.participant_blue_id if match.participant_red_id == champion_id else match.participant_red_id
            )
            lots = {
                lot.side: lot
                for lot in await TournamentReadService.current_lots(session, match.id)
            }
            champion_side = "RED" if match.participant_red_id == champion_id else "BLUE"
            path.append(
                {
                    "match_id": str(match.id),
                    "stage": match.stage_name,
                    "round_number": match.round_number,
                    "is_bye": match.is_bye,
                    "opponent": views.get(opponent_id).model_dump() if opponent_id in views else None,
                    "won": match.winner_id == champion_id,
                    "weapon": lots[champion_side].weapon if champion_side in lots else match.final_weapon,
                    "opponent_weapon": (
                        lots["BLUE" if champion_side == "RED" else "RED"].weapon
                        if ("BLUE" if champion_side == "RED" else "RED") in lots
                        else match.final_weapon
                    ),
                    "rounds_won": sum(
                        1
                        for r in await TournamentReadService.match_rounds(session, match.id)
                        if r.winner_participant_id == champion_id
                    ),
                }
            )

        champion_participant = by_id.get(champion_id)
        champion_view = views.get(champion_id)
        return {
            "competition_id": str(competition.id),
            "complete": True,
            "champion": {
                **(champion_view.model_dump() if champion_view else {}),
                "city": champion_participant.city if champion_participant else None,
                "club_id": str(champion_participant.club_id)
                if champion_participant and champion_participant.club_id
                else None,
            },
            "path": path,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
