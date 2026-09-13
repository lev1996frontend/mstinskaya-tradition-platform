"""Group-stage rankings, and the organizer's manual tie-breaks.

Split out of ``group_service.py``'s "standings" and "a tie the bouts could
not settle" sections. Depends on ``group_common`` for competition/group/match
lookups; :mod:`group_playoff_service` depends on this module's
:meth:`GroupStandingsService.rankings` for qualification, but nothing here
depends back on it.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.domain import groups as group_domain
from app.modules.tournaments.models import Competition, CompetitionEvent, CompetitionGroup, Participant
from app.modules.tournaments.services import group_common
from app.modules.tournaments.services.bracket_common import parse_id


class GroupStandingsService:
    @staticmethod
    async def rankings(
        session: AsyncSession, competition: Competition
    ) -> tuple[list[CompetitionGroup], dict[int, group_domain.GroupRanking], dict[UUID, object]]:
        """Rank every group from recorded results. Reads only."""
        from app.modules.tournaments.services.read_service import TournamentReadService

        groups = await group_common.list_groups(session, competition)
        matches = await group_common.list_group_matches(session, competition)
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

        overrides = await GroupStandingsService.tie_break_overrides(session, competition)

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
    async def tie_break_overrides(
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
        competition = await group_common.get_competition(session, competition_id)
        groups, rankings, views = await GroupStandingsService.rankings(session, competition)
        matches = await group_common.list_group_matches(session, competition)

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

        previous = (await GroupStandingsService.tie_break_overrides(session, competition)).get(group.id)
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
        return await GroupStandingsService.group_standings(session, str(competition.id))
