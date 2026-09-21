"""Bracket generation.

The algorithm itself lives in :mod:`app.modules.tournaments.domain.bracket`;
this module is the thin layer that reads participants out of the database,
asks the algorithm for a plan, and writes it down.

Two related concerns used to live in this same file and now have their own
modules instead:

* :mod:`app.modules.tournaments.services.advancement_service` seats a bout's
  winner in the next round and closes out walkovers — used here (a bye is
  advanced the moment it is written) but self-contained, so it does not
  import anything from this module.
* :mod:`app.modules.tournaments.services.withdrawal_service` pulls a fighter
  back out of a bracket that is already under way, and substitutes a
  replacement. It depends on this module (for :meth:`BracketService._competition`
  and :meth:`BracketService._display_name`) and on ``advancement_service``,
  but nothing here depends on it back.

``parse_id`` and ``ready_status`` are re-exported from
:mod:`app.modules.tournaments.services.bracket_common` so the existing
``from .bracket_service import parse_id`` call sites elsewhere in
``tournaments`` did not need to change.
"""

from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.athletes_access import Athlete, get_athletes_by_ids
from app.core.identity_access import User, get_users_by_ids
from app.modules.tournaments.domain import bracket as bracket_domain
from app.modules.tournaments.models import (
    Bracket,
    Competition,
    CompetitionEvent,
    Draw,
    Match,
    Participant,
    Tournament,
    TournamentCategory,
)
from app.modules.tournaments.services.advancement_service import AdvancementService
from app.modules.tournaments.services.bracket_common import (
    NOT_IN_DRAW_STATUSES,
    TOURNAMENT_STATUS_BRACKET_CREATED,
    parse_id,
    ready_status,
)
from app.modules.tournaments.services.read_common import athlete_display_name

__all__ = ["BracketService", "parse_id", "ready_status"]


class BracketService:
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
    async def entrants(session: AsyncSession, competition: Competition) -> list[bracket_domain.Entrant]:
        """Active participants of a competition, as seeding-algorithm input.

        Withdrawn / disqualified entries are left out: they are not in the draw.
        Nor are reserves, who have not entered it yet.
        """
        participants = list(
            await session.scalars(
                select(Participant)
                .where(Participant.competition_id == competition.id)
                .order_by(Participant.seed.asc().nulls_last(), Participant.created_at.asc())
            )
        )
        active = [p for p in participants if p.status not in NOT_IN_DRAW_STATUSES]

        athlete_ids = {p.athlete_id for p in active if p.athlete_id}
        athletes: dict[UUID, Athlete] = {}
        users: dict[UUID, User] = {}
        if athlete_ids:
            athletes = await get_athletes_by_ids(session, athlete_ids)
            user_ids = {a.user_id for a in athletes.values() if a.user_id}
            users = await get_users_by_ids(session, user_ids)

        result: list[bracket_domain.Entrant] = []
        for participant in active:
            result.append(
                bracket_domain.Entrant(
                    participant_id=str(participant.id),
                    display_name=BracketService._display_name(participant, athletes, users),
                    city=participant.city,
                    club=participant.club_name,
                    seed=participant.seed,
                )
            )
        return result

    @staticmethod
    def _display_name(
        participant: Participant, athletes: dict[UUID, Athlete], users: dict[UUID, User]
    ) -> str:
        """Same resolution as the read side, so a preview and the bracket agree."""
        athlete = athletes.get(participant.athlete_id) if participant.athlete_id else None
        user = users.get(athlete.user_id) if athlete is not None and athlete.user_id else None
        return athlete_display_name(athlete, user, participant.display_name)

    # ------------------------------------------------------------------ #
    # planning
    # ------------------------------------------------------------------ #

    @staticmethod
    async def preview(session: AsyncSession, competition_id: str) -> dict:
        """Dry run: the shape of the bracket and the city verdict, nothing written.

        The wizard shows this to the organizer *before* they commit, which is the
        whole point of reporting unavoidable collisions rather than hiding them.
        """
        competition = await BracketService._competition(session, competition_id)
        entrants = await BracketService.entrants(session, competition)
        if len(entrants) < 2:
            raise HTTPException(status_code=400, detail="A bracket needs at least two participants")
        plan = bracket_domain.build_plan(entrants)
        return BracketService._plan_payload(plan)

    @staticmethod
    def _plan_payload(plan: bracket_domain.BracketPlan) -> dict:
        return {
            "bracket_size": plan.bracket_size,
            "participant_count": plan.participant_count,
            "bye_count": plan.bye_count,
            "round_count": plan.round_count,
            "strategy": plan.strategy,
            "city_constraint_satisfied": plan.city_constraint_satisfied,
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
            "first_round": [
                {
                    "position": pair.position,
                    "is_bye": pair.is_bye,
                    "participant_a_id": pair.a.participant_id if pair.a else None,
                    "participant_a_name": pair.a.display_name if pair.a else None,
                    "participant_a_city": pair.a.city if pair.a else None,
                    "participant_b_id": pair.b.participant_id if pair.b else None,
                    "participant_b_name": pair.b.display_name if pair.b else None,
                    "participant_b_city": pair.b.city if pair.b else None,
                }
                for pair in plan.first_round
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
        actor_id: UUID | None = None,
        final_weapon: str | None = None,
        rng: secrets.SystemRandom | None = None,
    ) -> dict:
        competition = await BracketService._competition(session, competition_id)

        existing = await session.scalar(select(Match.id).where(Match.competition_id == competition.id))
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail="This competition already has matches; delete them before regenerating the bracket",
            )

        entrants = await BracketService.entrants(session, competition)
        if len(entrants) < 2:
            raise HTTPException(status_code=400, detail="A bracket needs at least two participants")

        plan = bracket_domain.build_plan(entrants, rng=rng)

        category = await session.scalar(
            select(TournamentCategory)
            .where(TournamentCategory.tournament_id == competition.tournament_id)
            .order_by(TournamentCategory.created_at.asc())
        )
        draw = Draw(
            competition_id=competition.id,
            name="Основная сетка",
            draw_type="SEEDED" if any(e.seed is not None for e in entrants) else "RANDOM",
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
            category_id=category.id if category else None,
        )

        payload = BracketService._plan_payload(plan)
        session.add(
            CompetitionEvent(
                competition_id=competition.id,
                event_type="BRACKET_GENERATED",
                description=(
                    f"Сетка на {plan.bracket_size} мест, участников {plan.participant_count}, "
                    f"свободных проходов {plan.bye_count}"
                ),
                payload={**payload, "actor_id": str(actor_id) if actor_id else None},
            )
        )

        await BracketService._open_first_round(session, first_round)

        tournament = await session.get(Tournament, competition.tournament_id)
        if tournament is not None and tournament.status in {"DRAFT", "REGISTRATION", "READY"}:
            tournament.status = TOURNAMENT_STATUS_BRACKET_CREATED
        if competition.status == "DRAFT":
            competition.status = "RUNNING"

        await session.flush()
        return payload

    @staticmethod
    async def _write_playoff(
        session: AsyncSession,
        competition: Competition,
        draw: Draw,
        plan: bracket_domain.BracketPlan,
        *,
        final_weapon: str | None,
        category_id: UUID | None,
    ) -> list[Match]:
        """Write a whole knockout tree for ``plan`` and seat its first round.

        Deliberately carries **no** "already generated" guard: that belongs to
        the caller. :meth:`generate` refuses to rebuild a bracket that exists,
        while the group-stage path needs to add a playoff on top of a group
        stage whose matches are already in the table — same tree-writing, two
        different preconditions.

        Returns the first round, so the caller can log its own event before
        opening the round (see :meth:`_open_first_round`); the journal reads
        newest-first, and the "bracket generated" entry must not end up beneath
        the byes it caused.
        """
        # Rounds are built back to front so every match already knows the id of
        # the match it feeds. ``rounds[0]`` ends up being the first round.
        round_sizes: list[int] = []
        size = plan.bracket_size // 2
        while size >= 1:
            round_sizes.append(size)
            size //= 2

        total_rounds = len(round_sizes)
        rounds: list[list[Match]] = []
        next_round: list[Match] | None = None
        # Walk from the final backwards; ``offset`` 0 is the final, so the first
        # round ends up with ``round_number == 1``.
        for offset, match_count in enumerate(reversed(round_sizes)):
            stage_name = bracket_domain.stage_name_for_round(match_count)
            round_number = total_rounds - offset
            current: list[Match] = []
            for index in range(match_count):
                bracket_row = Bracket(
                    competition_id=competition.id,
                    draw_id=draw.id,
                    name=f"{stage_name} {index + 1}",
                    stage_type="PLAYOFF",
                    round=stage_name,
                    position=index + 1,
                    round_count=total_rounds,
                )
                session.add(bracket_row)
                await session.flush()

                match = Match(
                    tournament_id=competition.tournament_id,
                    category_id=category_id,
                    competition_id=competition.id,
                    draw_id=draw.id,
                    bracket_id=bracket_row.id,
                    stage_name=stage_name,
                    round_number=round_number,
                    position=index + 1,
                    status="SCHEDULED",
                    final_weapon=final_weapon if stage_name == "FINAL" else None,
                )
                if next_round is not None:
                    parent = next_round[index // 2]
                    match.next_match_id = parent.id
                    match.next_slot = "RED" if index % 2 == 0 else "BLUE"
                session.add(match)
                await session.flush()
                current.append(match)
            rounds.append(current)
            next_round = current
        rounds.reverse()

        # Seat the first round from the plan.
        first_round = rounds[0]
        for pair, match in zip(plan.first_round, first_round):
            match.participant_red_id = UUID(pair.a.participant_id) if pair.a else None
            match.participant_blue_id = UUID(pair.b.participant_id) if pair.b else None
            match.is_bye = pair.is_bye
        await session.flush()
        return first_round

    @staticmethod
    async def _open_first_round(session: AsyncSession, first_round: list[Match]) -> None:
        """Resolve byes and mark real pairs ready.

        Byes resolve immediately: the lone fighter is through, and the win is
        propagated through the same wiring every real result uses.
        """
        for match in first_round:
            if match.is_bye:
                await BracketService._resolve_bye(session, match)
            elif match.participant_red_id and match.participant_blue_id:
                match.status = ready_status(match)

    @staticmethod
    async def _resolve_bye(session: AsyncSession, match: Match) -> None:
        """Mark a bye finished and push its lone fighter onward."""
        winner_id = match.participant_red_id or match.participant_blue_id
        match.status = "FINISHED"
        match.winner_id = winner_id
        session.add(
            CompetitionEvent(
                competition_id=match.competition_id,
                event_type="BYE_GRANTED",
                description="Свободный проход в следующий круг",
                payload={"match_id": str(match.id), "participant_id": str(winner_id) if winner_id else None},
            )
        )
        await AdvancementService.advance_winner(session, match)

    # ------------------------------------------------------------------ #
    # facade: advancement / withdrawal / summary
    # ------------------------------------------------------------------ #
    #
    # These four methods and champion_summary below do nothing but forward to
    # the module that now owns the logic. They exist so the many external
    # call sites (routers/bouts.py, bout_service.py, engine_service.py) that
    # already say ``BracketService.advance_winner(...)`` etc. did not have to
    # change when advancement/withdrawal/summary moved into their own files.
    # withdrawal_service and bracket_summary_service both import
    # BracketService, so their imports here are function-local to avoid a
    # circular import at module load time.

    @staticmethod
    async def advance_winner(session: AsyncSession, match: Match) -> Match | None:
        return await AdvancementService.advance_winner(session, match)

    @staticmethod
    async def sync_tournament_state(session: AsyncSession, match: Match) -> None:
        await AdvancementService.sync_tournament_state(session, match)

    @staticmethod
    async def withdraw_participant(session: AsyncSession, participant_id: str, **kwargs) -> dict:
        from app.modules.tournaments.services.withdrawal_service import WithdrawalService

        return await WithdrawalService.withdraw_participant(session, participant_id, **kwargs)

    @staticmethod
    async def replace_withdrawn(session: AsyncSession, participant_id: str, **kwargs) -> dict:
        from app.modules.tournaments.services.withdrawal_service import WithdrawalService

        return await WithdrawalService.replace_withdrawn(session, participant_id, **kwargs)

    @staticmethod
    async def replacement_candidates(session: AsyncSession, participant_id: str) -> dict:
        from app.modules.tournaments.services.withdrawal_service import WithdrawalService

        return await WithdrawalService.replacement_candidates(session, participant_id)

    @staticmethod
    async def champion_summary(session: AsyncSession, competition_id: str) -> dict:
        from app.modules.tournaments.services.bracket_summary_service import BracketSummaryService

        return await BracketSummaryService.champion_summary(session, competition_id)
