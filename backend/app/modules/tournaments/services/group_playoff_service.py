"""Who qualifies out of the group stage, and building the playoff from them.

Split out of ``group_service.py``'s "into the playoff" section. Depends on
``group_common`` for lookups, :class:`GroupStandingsService` for rankings,
and :class:`BracketService` to write the knockout tree — the same three
dependencies ``group_service.py`` itself used to reach for directly.
"""

from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import groups as group_domain
from app.modules.tournaments.models import CompetitionEvent, Draw, Match
from app.modules.tournaments.services import group_common
from app.modules.tournaments.services.bracket_service import BracketService
from app.modules.tournaments.services.group_standings_service import GroupStandingsService


class GroupPlayoffService:
    @staticmethod
    async def qualification(session: AsyncSession, competition_id: str) -> dict:
        """Who goes through, and what still stands in the way."""
        competition = await group_common.get_competition(session, competition_id)
        groups, rankings, views = await GroupStandingsService.rankings(session, competition)
        matches = await group_common.list_group_matches(session, competition)

        blockers: list[dict] = []
        if not groups:
            blockers.append(
                {"code": "NO_GROUP_STAGE", "message": "Групповой этап не создан", "ids": []}
            )
        playoff_exists = await session.scalar(
            select(Match.id).where(
                Match.competition_id == competition.id, Match.stage_name != group_common.STAGE_GROUP
            )
        )
        if playoff_exists is not None:
            blockers.append(
                {"code": "PLAYOFF_ALREADY_BUILT", "message": "Плей-офф уже построен", "ids": []}
            )
        unplayed = [str(m.id) for m in matches if m.status != "FINISHED"]
        if unplayed:
            blockers.append(
                {
                    "code": "GROUP_STAGE_INCOMPLETE",
                    "message": f"Не сыграно боёв: {len(unplayed)}",
                    "ids": unplayed,
                }
            )
        for group in groups:
            for tie in rankings[group.ordinal].unresolved:
                blockers.append(
                    {
                        "code": "TIE_UNRESOLVED",
                        "message": f"{group.name}: {tie.reason}",
                        "ids": list(tie.participant_ids),
                    }
                )

        entrants = {
            e.participant_id: e for e in await BracketService.entrants(session, competition)
        }
        advance = {group.ordinal: group.advance_count for group in groups}
        ordered = group_domain.order_qualifiers(rankings, entrants, advance=advance)

        plan = None
        if not blockers and len(ordered) >= 2:
            plan = group_domain.build_playoff_plan(ordered)

        return {
            "competition_id": str(competition.id),
            "ready": not blockers and len(ordered) >= 2,
            "blockers": blockers,
            "qualifiers": [
                {
                    "participant_id": q.entrant.participant_id,
                    "display_name": q.entrant.display_name,
                    "group_ordinal": q.group_ordinal,
                    "group_name": q.group_name,
                    "place_in_group": q.place_in_group,
                    "seed": index + 1,
                }
                for index, q in enumerate(ordered)
            ],
            "plan": BracketService._plan_payload(plan) if plan is not None else None,
        }

    @staticmethod
    async def promote_to_playoff(
        session: AsyncSession,
        competition_id: str,
        *,
        actor_id: UUID | None = None,
        final_weapon: str | None = None,
        rng: secrets.SystemRandom | None = None,
    ) -> dict:
        """Build the knockout stage out of the group winners.

        Not :meth:`BracketService.generate`, whose 409 exists to stop a bracket
        being rebuilt: here the competition legitimately already has matches —
        the group ones. Different precondition, so a different entry point, and
        the direct-knockout guard stays exactly as strict as it was.
        """
        competition = await group_common.get_competition(session, competition_id)
        state = await GroupPlayoffService.qualification(session, str(competition.id))
        if state["blockers"]:
            raise HTTPException(status_code=409, detail={"blockers": state["blockers"]})
        if len(state["qualifiers"]) < 2:
            raise HTTPException(status_code=400, detail="Из подгрупп вышло меньше двух бойцов")

        groups, rankings, _ = await GroupStandingsService.rankings(session, competition)
        entrants = {
            e.participant_id: e for e in await BracketService.entrants(session, competition)
        }
        ordered = group_domain.order_qualifiers(
            rankings, entrants, advance={g.ordinal: g.advance_count for g in groups}
        )
        plan = group_domain.build_playoff_plan(ordered, rng=rng)

        draw = Draw(
            competition_id=competition.id,
            name="Плей-офф",
            draw_type="SEEDED",
            status="GENERATED",
        )
        session.add(draw)
        await session.flush()

        first_round = await BracketService._write_playoff(
            session,
            competition,
            draw,
            plan,
            final_weapon=final_weapon,
            category_id=competition.category_id,
        )

        payload = BracketService._plan_payload(plan)
        session.add(
            CompetitionEvent(
                competition_id=competition.id,
                event_type="BRACKET_GENERATED",
                description=(
                    f"Плей-офф из подгрупп: {len(ordered)} вышедших, "
                    f"сетка на {plan.bracket_size} мест"
                ),
                payload={
                    **payload,
                    "source": "GROUP_STAGE",
                    "qualifiers": state["qualifiers"],
                    "actor_id": str(actor_id) if actor_id else None,
                },
            )
        )
        await BracketService._open_first_round(session, first_round)
        await session.flush()
        return payload
