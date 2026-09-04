"""Bracket generation and advancement.

The algorithm itself lives in :mod:`app.modules.tournaments.domain.bracket`;
this module is the thin layer that reads participants out of the database, asks
the algorithm for a plan, and writes it down.

Advancement is here too, because it is the same concern: the bracket wiring
(``Match.next_match_id`` / ``Match.next_slot``) is written once at generation
time and is thereafter the *only* thing that moves a fighter into the next
round. No client ever assigns a participant to a later slot.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete
from app.modules.identity.models import User
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

#: Statuses a bout can hold. ``FINISHED`` is the persisted spelling of the
#: spec's ``COMPLETED``; it predates this work and is kept so the existing API
#: keeps its meaning.
BOUT_STATUSES: frozenset[str] = frozenset(
    {"SCHEDULED", "READY_FOR_LOT", "LOT_COMPLETED", "READY", "IN_PROGRESS", "FINISHED", "CANCELLED"}
)

#: Bouts that have not started and can still accept an incoming fighter.
PENDING_STATUSES: frozenset[str] = frozenset({"SCHEDULED", "READY_FOR_LOT", "READY"})

TOURNAMENT_STATUS_BRACKET_CREATED = "BRACKET_CREATED"


def parse_id(value: str, label: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} id") from None


def ready_status(match: Match) -> str:
    """The "waiting to start" status for this bout.

    A final skips the lot states entirely, so it goes straight to ``READY``.
    """
    return "READY" if match.is_final else "READY_FOR_LOT"


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
        """
        participants = list(
            await session.scalars(
                select(Participant)
                .where(Participant.competition_id == competition.id)
                .order_by(Participant.seed.asc().nulls_last(), Participant.created_at.asc())
            )
        )
        active = [p for p in participants if p.status not in {"WITHDRAWN", "DISQUALIFIED"}]

        athlete_ids = {p.athlete_id for p in active if p.athlete_id}
        athletes: dict[UUID, Athlete] = {}
        users: dict[UUID, User] = {}
        if athlete_ids:
            rows = await session.scalars(select(Athlete).where(Athlete.id.in_(athlete_ids)))
            athletes = {a.id: a for a in rows}
            user_ids = {a.user_id for a in athletes.values() if a.user_id}
            if user_ids:
                user_rows = await session.scalars(select(User).where(User.id.in_(user_ids)))
                users = {u.id: u for u in user_rows}

        result: list[bracket_domain.Entrant] = []
        for participant in active:
            result.append(
                bracket_domain.Entrant(
                    participant_id=str(participant.id),
                    display_name=BracketService._display_name(participant, athletes, users),
                    city=participant.city,
                    seed=participant.seed,
                )
            )
        return result

    @staticmethod
    def _display_name(
        participant: Participant, athletes: dict[UUID, Athlete], users: dict[UUID, User]
    ) -> str:
        """Same resolution as the read side, so a preview and the bracket agree."""
        from app.modules.tournaments.services.read_service import _athlete_display_name

        athlete = athletes.get(participant.athlete_id) if participant.athlete_id else None
        user = users.get(athlete.user_id) if athlete is not None and athlete.user_id else None
        return _athlete_display_name(athlete, user, participant.display_name)

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
            "unavoidable_collisions": [
                {
                    "position": c.position,
                    "city": c.city,
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
        await BracketService.advance_winner(session, match)

    # ------------------------------------------------------------------ #
    # advancement
    # ------------------------------------------------------------------ #

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
        return target

    # ------------------------------------------------------------------ #
    # tournament-level state
    # ------------------------------------------------------------------ #

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

    # ------------------------------------------------------------------ #
    # summary
    # ------------------------------------------------------------------ #

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
