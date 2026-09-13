"""The group stage: suggesting a layout, previewing it, and generating it.

The algorithm is in :mod:`app.modules.tournaments.domain.groups`; this is the
layer that reads entrants out of the database, asks for a plan, and writes
it down.

Three concerns that used to live in this same 693-line file now have their
own modules instead:

* :mod:`group_common` — competition/group/match lookups every group module
  shares, plus the two module-level constants.
* :mod:`group_standings_service` (``GroupStandingsService``) — rankings,
  the organizer's manual tie-breaks, and the standings projection.
* :mod:`group_playoff_service` (``GroupPlayoffService``) — qualification and
  building the knockout stage out of the group winners.

:class:`GroupService` keeps thin facade methods (``get_group``,
``group_standings``, ``resolve_tie``, ``qualification``,
``promote_to_playoff``) forwarding to whichever module now owns each, so the
many router call sites needed no changes.

Three guards remain the point of this module, and each refuses rather than
guesses:

* ``generate`` will not run without both numbers stated explicitly — the
  platform is not allowed to decide how a tournament is divided.
* ``promote_to_playoff`` refuses while any group bout is unplayed or any place
  is genuinely tied, and says which.
* a tie the bouts cannot settle is never broken here; it goes back as a
  question for the organizer, whose answer is recorded with its reason.
"""

from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import bracket as bracket_domain
from app.modules.tournaments.domain import groups as group_domain
from app.modules.tournaments.models import (
    Bracket,
    Competition,
    CompetitionEvent,
    CompetitionGroup,
    Draw,
    Match,
    Participant,
)
from app.modules.tournaments.services import group_common
from app.modules.tournaments.services.bracket_service import BracketService, ready_status

#: Re-exported for the existing call sites that import these two names from
#: *this* module rather than group_common, where they now live.
GROUP_FORMATS = group_common.GROUP_FORMATS
STAGE_GROUP = group_common.STAGE_GROUP

__all__ = ["GroupService", "GROUP_FORMATS", "STAGE_GROUP"]


class GroupService:
    # ------------------------------------------------------------------ #
    # suggesting and previewing
    # ------------------------------------------------------------------ #

    @staticmethod
    async def suggest(session: AsyncSession, competition_id: str) -> dict:
        """Every valid split of this field, with one marked as advice.

        Advice only. ``generate`` requires the organizer to state both numbers
        regardless of what is marked here, so the platform cannot slip into
        deciding a tournament's format by default.
        """
        competition = await group_common.get_competition(session, competition_id)
        entrants = await BracketService.entrants(session, competition)
        suggestion = group_domain.suggest_group_layout(len(entrants))
        return {
            "competition_id": str(competition.id),
            "participant_count": suggestion.participant_count,
            "rationale": suggestion.rationale,
            "options": [vars(option) | {"group_sizes": list(option.group_sizes)} for option in suggestion.options],
        }

    @staticmethod
    async def preview(
        session: AsyncSession,
        competition_id: str,
        *,
        group_count: int,
        advance_per_group: int,
    ) -> dict:
        """Dry run of the deal. Writes nothing."""
        competition = await group_common.get_competition(session, competition_id)
        GroupService._check_format(competition, group_count)
        entrants = await BracketService.entrants(session, competition)
        plan = GroupService._plan(entrants, group_count, advance_per_group)
        return GroupService._plan_payload(competition, plan)

    @staticmethod
    def _check_format(competition: Competition, group_count: int) -> None:
        if competition.format not in GROUP_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Групповой этап доступен для форматов «круговая» и «подгруппы + плей-офф»; "
                    f"у этой дисциплины формат {competition.format}"
                ),
            )
        if competition.format == "ROUND_ROBIN" and group_count != 1:
            raise HTTPException(
                status_code=400,
                detail="Круговая система — это одна подгруппа; для нескольких выберите «подгруппы + плей-офф»",
            )

    @staticmethod
    def _plan(
        entrants: list[bracket_domain.Entrant],
        group_count: int,
        advance_per_group: int,
        *,
        rng: secrets.SystemRandom | None = None,
    ) -> group_domain.GroupPlan:
        try:
            return group_domain.build_group_plan(
                entrants,
                group_count=group_count,
                advance_per_group=advance_per_group,
                rng=rng,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from None

    @staticmethod
    def _plan_payload(competition: Competition, plan: group_domain.GroupPlan) -> dict:
        return {
            "competition_id": str(competition.id),
            "group_count": plan.group_count,
            "participant_count": plan.participant_count,
            "advance_per_group": plan.advance_per_group,
            "qualifier_count": plan.qualifier_count,
            "match_count": plan.match_count,
            "strategy": plan.strategy,
            "separation_satisfied": plan.separation_satisfied,
            "unavoidable_collisions": [
                {
                    "position": c.position,
                    "kind": c.kind,
                    "value": c.value,
                    "city": c.city,
                    "club": c.club,
                    "participant_a_id": c.participant_a_id,
                    "participant_b_id": c.participant_b_id,
                    "participant_a_name": c.participant_a_name,
                    "participant_b_name": c.participant_b_name,
                }
                for c in plan.unavoidable_collisions
            ],
            "groups": [
                {
                    "ordinal": group.ordinal,
                    "name": group.name,
                    "advance_count": group.advance_count,
                    "members": [
                        {"participant_id": e.participant_id, "display_name": e.display_name}
                        for e in group.entrants
                    ],
                }
                for group in plan.groups
            ],
        }

    # ------------------------------------------------------------------ #
    # generation
    # ------------------------------------------------------------------ #

    @staticmethod
    async def generate(
        session: AsyncSession,
        competition_id: str,
        *,
        group_count: int,
        advance_per_group: int,
        actor_id: UUID | None = None,
        rng: secrets.SystemRandom | None = None,
    ) -> dict:
        competition = await group_common.get_competition(session, competition_id)
        GroupService._check_format(competition, group_count)

        existing = await session.scalar(select(Match.id).where(Match.competition_id == competition.id))
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail="В дисциплине уже есть бои; групповой этап строится до них",
            )

        entrants = await BracketService.entrants(session, competition)
        plan = GroupService._plan(entrants, group_count, advance_per_group, rng=rng)
        suggestion = group_domain.suggest_group_layout(len(entrants))
        recommended = next((o for o in suggestion.options if o.is_default), None)

        draw = Draw(
            competition_id=competition.id,
            name="Групповой этап",
            draw_type="RANDOM" if all(e.seed is None for e in entrants) else "SEEDED",
            status="GENERATED",
        )
        session.add(draw)
        await session.flush()

        by_ordinal: dict[int, CompetitionGroup] = {}
        for slot in plan.groups:
            row = CompetitionGroup(
                competition_id=competition.id,
                draw_id=draw.id,
                name=slot.name,
                ordinal=slot.ordinal,
                advance_count=slot.advance_count,
            )
            session.add(row)
            await session.flush()
            by_ordinal[slot.ordinal] = row
            for entrant in slot.entrants:
                participant = await session.get(Participant, UUID(entrant.participant_id))
                if participant is not None:
                    participant.group_id = row.id

        category_id = competition.category_id
        for pairing in plan.pairings:
            group_row = by_ordinal[pairing.group_ordinal]
            bracket_row = Bracket(
                competition_id=competition.id,
                draw_id=draw.id,
                name=f"{group_row.name} · бой {pairing.position}",
                stage_type="GROUP",
                round=STAGE_GROUP,
                position=pairing.position,
            )
            session.add(bracket_row)
            await session.flush()

            match = Match(
                tournament_id=competition.tournament_id,
                category_id=category_id,
                competition_id=competition.id,
                draw_id=draw.id,
                bracket_id=bracket_row.id,
                stage_name=STAGE_GROUP,
                round_number=pairing.round_number,
                position=pairing.position,
                participant_red_id=UUID(pairing.a.participant_id),
                participant_blue_id=UUID(pairing.b.participant_id),
                # Everyone is seated from the start, so a group bout is waiting
                # on its lot rather than on an opponent.
                status="SCHEDULED",
            )
            session.add(match)
            await session.flush()
            match.status = ready_status(match)

        payload = GroupService._plan_payload(competition, plan)

        # Two events, not one. The organizer's *decision* has to be on record
        # separately from what the algorithm then produced with it.
        session.add(
            CompetitionEvent(
                competition_id=competition.id,
                event_type="GROUP_STAGE_CONFIGURED",
                description=(
                    f"Подгрупп: {group_count}, выходит из каждой: {advance_per_group}"
                ),
                payload={
                    "group_count": group_count,
                    "advance_per_group": advance_per_group,
                    "suggested_group_count": recommended.group_count if recommended else None,
                    "suggested_advance_per_group": recommended.advance_per_group if recommended else None,
                    "organizer_overrode_suggestion": bool(
                        recommended
                        and (
                            recommended.group_count != group_count
                            or recommended.advance_per_group != advance_per_group
                        )
                    ),
                    "actor_id": str(actor_id) if actor_id else None,
                },
            )
        )
        session.add(
            CompetitionEvent(
                competition_id=competition.id,
                event_type="GROUP_STAGE_GENERATED",
                description=f"Разбито на {group_count} подгрупп, боёв: {plan.match_count}",
                payload=payload,
            )
        )

        if competition.status == "DRAFT":
            competition.status = "RUNNING"
        await session.flush()
        return payload

    # ------------------------------------------------------------------ #
    # facade: lookups / standings / tie-break / qualification / playoff
    # ------------------------------------------------------------------ #
    #
    # Forward to whichever module now owns the logic (see the module
    # docstring). Imports are function-local because group_standings_service
    # and group_playoff_service both import from group_common, not from
    # here, but keeping these lazy avoids any risk of a future cycle as this
    # module grows.

    @staticmethod
    async def get_group(session: AsyncSession, group_id: str) -> CompetitionGroup:
        return await group_common.get_group(session, group_id)

    @staticmethod
    async def group_standings(session: AsyncSession, competition_id: str) -> dict:
        from app.modules.tournaments.services.group_standings_service import GroupStandingsService

        return await GroupStandingsService.group_standings(session, competition_id)

    @staticmethod
    async def resolve_tie(session: AsyncSession, group_id: str, **kwargs) -> dict:
        from app.modules.tournaments.services.group_standings_service import GroupStandingsService

        return await GroupStandingsService.resolve_tie(session, group_id, **kwargs)

    @staticmethod
    async def qualification(session: AsyncSession, competition_id: str) -> dict:
        from app.modules.tournaments.services.group_playoff_service import GroupPlayoffService

        return await GroupPlayoffService.qualification(session, competition_id)

    @staticmethod
    async def promote_to_playoff(session: AsyncSession, competition_id: str, **kwargs) -> dict:
        from app.modules.tournaments.services.group_playoff_service import GroupPlayoffService

        return await GroupPlayoffService.promote_to_playoff(session, competition_id, **kwargs)
