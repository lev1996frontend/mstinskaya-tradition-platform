"""The group stage, from dealing the field to seeding the playoff.

The algorithm is in :mod:`app.modules.tournaments.domain.groups`; this is the
layer that reads entrants out of the database, asks for a plan, writes it down,
and reads the result back.

Three guards are the point of this module, and each refuses rather than guesses:

* ``generate`` will not run without both numbers stated explicitly — the
  platform is not allowed to decide how a tournament is divided.
* ``promote_to_playoff`` refuses while any group bout is unplayed or any place
  is genuinely tied, and says which.
* a tie the bouts cannot settle is never broken here; it goes back as a
  question for the organizer, whose answer is recorded with its reason.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
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
    MatchResult,
    Participant,
)
from app.modules.tournaments.services.bracket_service import (
    BracketService,
    parse_id,
    ready_status,
)

#: Formats that may hold a group stage. ``ROUND_ROBIN`` is one group — which is
#: precisely the five-fighter example in ``docs/tournament-engine.md``, где
#: круговая заканчивается полуфиналами.
GROUP_FORMATS: frozenset[str] = frozenset({"GROUP_PLAYOFF", "ROUND_ROBIN"})

STAGE_GROUP = "GROUP"


class GroupService:
    # ------------------------------------------------------------------ #
    # reading the field
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _competition(session: AsyncSession, competition_id: str) -> Competition:
        item = await session.get(Competition, parse_id(competition_id, "competition"))
        if item is None:
            raise HTTPException(status_code=404, detail="Competition not found")
        return item

    @staticmethod
    async def get_group(session: AsyncSession, group_id: str) -> CompetitionGroup:
        item = await session.get(CompetitionGroup, parse_id(group_id, "group"))
        if item is None:
            raise HTTPException(status_code=404, detail="Group not found")
        return item

    @staticmethod
    async def _groups(session: AsyncSession, competition: Competition) -> list[CompetitionGroup]:
        return list(
            await session.scalars(
                select(CompetitionGroup)
                .where(CompetitionGroup.competition_id == competition.id)
                .order_by(CompetitionGroup.ordinal.asc())
            )
        )

    @staticmethod
    async def _group_matches(session: AsyncSession, competition: Competition) -> list[Match]:
        return list(
            await session.scalars(
                select(Match)
                .where(Match.competition_id == competition.id, Match.stage_name == STAGE_GROUP)
                .order_by(Match.position.asc().nulls_last())
            )
        )

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
        competition = await GroupService._competition(session, competition_id)
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
        competition = await GroupService._competition(session, competition_id)
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
        competition = await GroupService._competition(session, competition_id)
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
    # standings
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _rankings(
        session: AsyncSession, competition: Competition
    ) -> tuple[list[CompetitionGroup], dict[int, group_domain.GroupRanking], dict[UUID, object]]:
        """Rank every group from recorded results. Reads only."""
        from app.modules.tournaments.services.read_service import TournamentReadService

        groups = await GroupService._groups(session, competition)
        matches = await GroupService._group_matches(session, competition)
        participants = list(
            await session.scalars(
                select(Participant).where(Participant.competition_id == competition.id)
            )
        )
        views = await TournamentReadService.build_participant_views(session, participants)
        by_group: dict[UUID, list[Participant]] = {}
        for participant in participants:
            if participant.group_id is not None:
                by_group.setdefault(participant.group_id, []).append(participant)

        overrides = await GroupService._tie_break_overrides(session, competition)

        rankings: dict[int, group_domain.GroupRanking] = {}
        for group in groups:
            members = by_group.get(group.id, [])
            member_ids = {member.id for member in members}
            own = [
                match
                for match in matches
                if match.participant_red_id in member_ids or match.participant_blue_id in member_ids
            ]
            records: dict[UUID, dict] = {
                member.id: {"played": 0, "wins": 0, "losses": 0, "draws": 0, "no_results": 0}
                for member in members
            }
            head_to_head: dict[tuple[str, str], str | None] = {}
            complete = True
            for match in own:
                red, blue = match.participant_red_id, match.participant_blue_id
                if match.status != "FINISHED":
                    complete = False
                    continue
                if red in records:
                    records[red]["played"] += 1
                if blue in records:
                    records[blue]["played"] += 1
                winner = match.winner_id
                if winner is None:
                    for side in (red, blue):
                        if side in records:
                            records[side]["no_results"] += 1
                    continue
                loser = blue if winner == red else red
                if winner in records:
                    records[winner]["wins"] += 1
                if loser in records:
                    records[loser]["losses"] += 1
                if red is not None and blue is not None:
                    head_to_head[(str(red), str(blue))] = str(winner)

            ranking = group_domain.rank_group(
                [
                    group_domain.GroupRecord(
                        participant_id=str(member.id),
                        display_name=views[member.id].display_name if member.id in views else "—",
                        **records[member.id],
                    )
                    for member in members
                ],
                head_to_head,
                manual_order=overrides.get(group.id, []),
                complete=complete and bool(own),
            )
            rankings[group.ordinal] = ranking
        return groups, rankings, views

    @staticmethod
    async def _tie_break_overrides(
        session: AsyncSession, competition: Competition
    ) -> dict[UUID, list[str]]:
        """The organizer's manual orderings, read out of the journal.

        Stored as events rather than a table: a tie-break is a decision about a
        moment, it is always accompanied by a reason, and the journal is already
        the place this codebase keeps decisions that must stay auditable.
        """
        events = list(
            await session.scalars(
                select(CompetitionEvent)
                .where(
                    CompetitionEvent.competition_id == competition.id,
                    CompetitionEvent.event_type == "GROUP_TIE_RESOLVED",
                )
                .order_by(CompetitionEvent.created_at.asc())
            )
        )
        latest: dict[UUID, list[str]] = {}
        for event in events:
            payload = event.payload or {}
            group_id = payload.get("group_id")
            ordering = payload.get("ordering")
            if group_id and isinstance(ordering, list):
                latest[UUID(group_id)] = [str(item) for item in ordering]
        return latest

    @staticmethod
    async def group_standings(session: AsyncSession, competition_id: str) -> dict:
        competition = await GroupService._competition(session, competition_id)
        groups, rankings, views = await GroupService._rankings(session, competition)
        matches = await GroupService._group_matches(session, competition)

        return {
            "competition_id": str(competition.id),
            "format": competition.format,
            "matches_total": len(matches),
            "matches_finished": sum(1 for m in matches if m.status == "FINISHED"),
            "decided": bool(groups) and all(r.is_decided for r in rankings.values()),
            "groups": [
                {
                    "id": str(group.id),
                    "ordinal": group.ordinal,
                    "name": group.name,
                    "advance_count": group.advance_count,
                    "complete": rankings[group.ordinal].complete,
                    "decided": rankings[group.ordinal].is_decided,
                    "rows": [
                        {
                            "rank": row.rank,
                            "resolved_by": row.resolved_by,
                            "participant": views[UUID(row.participant_id)].model_dump()
                            if UUID(row.participant_id) in views
                            else None,
                            "played": row.record.played,
                            "wins": row.record.wins,
                            "losses": row.record.losses,
                            "draws": row.record.draws,
                            "no_results": row.record.no_results,
                            "qualifies": row.rank is not None and row.rank <= group.advance_count,
                        }
                        for row in rankings[group.ordinal].ranks
                    ],
                    "unresolved": [
                        {
                            "participant_ids": list(tie.participant_ids),
                            "participant_names": [
                                views[UUID(pid)].display_name if UUID(pid) in views else "—"
                                for pid in tie.participant_ids
                            ],
                            "wins": tie.wins,
                            "losses": tie.losses,
                            "reason": tie.reason,
                        }
                        for tie in rankings[group.ordinal].unresolved
                    ],
                }
                for group in groups
            ],
        }

    # ------------------------------------------------------------------ #
    # a tie the bouts could not settle
    # ------------------------------------------------------------------ #

    @staticmethod
    async def resolve_tie(
        session: AsyncSession,
        group_id: str,
        *,
        ordering: list[str],
        reason: str,
        actor_id: UUID | None = None,
    ) -> dict:
        """Record the organizer's decision on a tie the results could not break.

        The platform never picks; it asks. The answer is written to the journal
        with its reason, and a later answer supersedes an earlier one without
        erasing it — the same append-and-correct pattern the lot override uses.
        """
        group = await session.get(CompetitionGroup, parse_id(group_id, "group"))
        if group is None:
            raise HTTPException(status_code=404, detail="Group not found")
        competition = await session.get(Competition, group.competition_id)
        if competition is None:
            raise HTTPException(status_code=404, detail="Competition not found")

        members = list(
            await session.scalars(select(Participant).where(Participant.group_id == group.id))
        )
        member_ids = {str(member.id) for member in members}
        unknown = [item for item in ordering if item not in member_ids]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail={"code": "NOT_IN_GROUP", "message": "В порядке указан не член подгруппы", "ids": unknown},
            )
        if len(set(ordering)) != len(ordering):
            raise HTTPException(status_code=400, detail="В порядке есть повторы")

        previous = (await GroupService._tie_break_overrides(session, competition)).get(group.id)
        session.add(
            CompetitionEvent(
                competition_id=competition.id,
                event_type="GROUP_TIE_RESOLVED",
                description=reason,
                payload={
                    "group_id": str(group.id),
                    "group_name": group.name,
                    "ordering": ordering,
                    "previous_ordering": previous,
                    "reason": reason,
                    "actor_id": str(actor_id) if actor_id else None,
                },
            )
        )
        await session.flush()
        return await GroupService.group_standings(session, str(competition.id))

    # ------------------------------------------------------------------ #
    # into the playoff
    # ------------------------------------------------------------------ #

    @staticmethod
    async def qualification(session: AsyncSession, competition_id: str) -> dict:
        """Who goes through, and what still stands in the way."""
        competition = await GroupService._competition(session, competition_id)
        groups, rankings, views = await GroupService._rankings(session, competition)
        matches = await GroupService._group_matches(session, competition)

        blockers: list[dict] = []
        if not groups:
            blockers.append(
                {"code": "NO_GROUP_STAGE", "message": "Групповой этап не создан", "ids": []}
            )
        playoff_exists = await session.scalar(
            select(Match.id).where(
                Match.competition_id == competition.id, Match.stage_name != STAGE_GROUP
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
        competition = await GroupService._competition(session, competition_id)
        state = await GroupService.qualification(session, str(competition.id))
        if state["blockers"]:
            raise HTTPException(status_code=409, detail={"blockers": state["blockers"]})
        if len(state["qualifiers"]) < 2:
            raise HTTPException(status_code=400, detail="Из подгрупп вышло меньше двух бойцов")

        groups, rankings, _ = await GroupService._rankings(session, competition)
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
