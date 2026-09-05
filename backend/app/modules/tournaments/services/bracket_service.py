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
from app.modules.tournaments.domain import eligibility
from app.modules.tournaments.models import (
    Bracket,
    Competition,
    CompetitionEvent,
    Draw,
    Match,
    MatchResult,
    Participant,
    ParticipantStatusHistory,
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

#: A fighter who is out of the draw. Both spellings behave identically for the
#: bracket; only the recorded reason differs.
OUT_STATUSES: frozenset[str] = frozenset({"WITHDRAWN", "DISQUALIFIED"})

#: A named reserve. Deliberately *not* folded into :data:`OUT_STATUSES`: those
#: mean "left", and a bout against someone who left is awarded as a walkover.
#: A reserve has not left, they have not yet entered — nobody is ever seated
#: opposite them, so there is nothing to award.
RESERVE_STATUS = "RESERVE"

#: Everyone the draw skips over, for whichever of the two reasons.
NOT_IN_DRAW_STATUSES: frozenset[str] = OUT_STATUSES | {RESERVE_STATUS}

#: A bout that has already been drawn for or started belongs to the judge until
#: it is finished or cancelled. Withdrawing out from under it would overwrite a
#: lot that was really thrown, so it is refused instead.
IN_FLIGHT_STATUSES: frozenset[str] = frozenset({"LOT_COMPLETED", "IN_PROGRESS"})

#: How a walkover is recorded, per the reason the fighter left.
WALKOVER_RESULT_TYPE: dict[str, str] = {
    "WITHDRAWN": "WITHDRAWAL",
    "DISQUALIFIED": "DISQUALIFICATION",
}

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
        await BracketService._walkover_if_opponent_out(session, target)
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
        await BracketService._record_walkover(
            session,
            target,
            winner_id=blue if red_out else red,
            loser=loser,
            reason=f"Соперник выбыл ({loser.status})",
        )

    # ------------------------------------------------------------------ #
    # withdrawal
    # ------------------------------------------------------------------ #

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
        await BracketService.advance_winner(session, match)
        await BracketService.sync_tournament_state(session, match)

    @staticmethod
    async def _unseat(session: AsyncSession, match: Match, participant_id: UUID) -> Match | None:
        """Take ``participant_id`` back out of the round ``match`` sent them to.

        The mirror image of :meth:`advance_winner`, and deliberately as narrow:
        it clears exactly the slot that advancement filled, and only while the
        target bout has not begun. Anything wider would be a rebuild.
        """
        if match.next_match_id is None:
            return None
        target = await session.get(Match, match.next_match_id)
        if target is None:
            return None
        if match.next_slot == "BLUE":
            if target.participant_blue_id == participant_id:
                target.participant_blue_id = None
        elif target.participant_red_id == participant_id:
            target.participant_red_id = None
        # A bout missing a side is not ready to be called.
        if target.status not in IN_FLIGHT_STATUSES and (
            target.participant_red_id is None or target.participant_blue_id is None
        ):
            target.status = "SCHEDULED"
        return target

    @staticmethod
    async def replace_withdrawn(
        session: AsyncSession,
        participant_id: str,
        *,
        reason: str,
        replacement_participant_id: str,
        actor_id: UUID | None = None,
    ) -> dict:
        """Put someone in the place of a fighter who was already withdrawn.

        The substitution that could not be named at the moment of withdrawal —
        the fighter pulled out in the morning and the club found a stand-in an
        hour later. By then the walkover has already been granted and the
        opponent already advanced, so this has to take both back.

        It refuses the moment that would mean erasing something real: if the
        opponent has already fought the bout they were advanced into, the
        walkover stays and so does the withdrawal. `docs/architecture.md`
        forbids invalidating results that happened, and an opponent's win in
        the next round is exactly that.
        """
        departing = await session.get(Participant, parse_id(participant_id, "participant"))
        if departing is None:
            raise HTTPException(status_code=404, detail="Participant not found")
        if departing.status != "WITHDRAWN":
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "STILL_IN_THE_DRAW" if departing.status not in OUT_STATUSES else departing.status,
                    "message": (
                        "Боец ещё в сетке — замену указывают прямо при снятии"
                        if departing.status not in OUT_STATUSES
                        else "Заменить можно только снявшегося, но не дисквалифицированного"
                    ),
                },
            )

        matches = list(
            await session.scalars(
                select(Match)
                .where(
                    (Match.participant_red_id == departing.id)
                    | (Match.participant_blue_id == departing.id)
                )
                .order_by(Match.round_number.asc().nulls_last(), Match.position.asc().nulls_last())
            )
        )

        results = {
            r.match_id: r
            for r in await session.scalars(
                select(MatchResult).where(MatchResult.match_id.in_([m.id for m in matches]))
            )
        } if matches else {}

        # A walkover is ours to take back; a judged decision is not.
        fought = [
            m
            for m in matches
            if (result := results.get(m.id)) is not None
            and result.result_type not in WALKOVER_RESULT_TYPE.values()
        ]
        if fought:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "ALREADY_FOUGHT",
                    "message": "Боец успел провести настоящий бой — его место принадлежит результатам",
                    "match_ids": [str(m.id) for m in fought],
                },
            )

        replacement = await BracketService._resolve_replacement(
            session, departing, replacement_participant_id, []
        )

        # Every walkover about to be undone must still be undoable: the fighter
        # who received it must not have fought on.
        reversible: list[tuple[Match, MatchResult]] = []
        for match in matches:
            result = results.get(match.id)
            if result is None or result.result_type not in WALKOVER_RESULT_TYPE.values():
                continue
            if match.next_match_id is not None:
                target = await session.get(Match, match.next_match_id)
                if target is not None and (
                    target.status in IN_FLIGHT_STATUSES
                    or target.status == "FINISHED"
                    or target.winner_id is not None
                ):
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "OPPONENT_ALREADY_FOUGHT",
                            "message": (
                                "Соперник уже провёл следующий бой — отменить его проход значило бы "
                                "стереть состоявшийся поединок"
                            ),
                            "match_ids": [str(target.id)],
                        },
                    )
            reversible.append((match, result))

        reopened: list[dict] = []
        for match, result in reversible:
            advanced = result.winner_participant_id
            await session.delete(result)
            match.winner_id = None
            match.status = ready_status(match)
            if advanced is not None:
                await BracketService._unseat(session, match, advanced)
            reopened.append({"match_id": str(match.id), "stage": match.stage_name})
            if match.competition_id is not None:
                session.add(
                    CompetitionEvent(
                        competition_id=match.competition_id,
                        event_type="WALKOVER_REVERSED",
                        description="Проход без боя отменён: на место выбывшего встал заменяющий",
                        payload={
                            "match_id": str(match.id),
                            "stage": match.stage_name,
                            "was_awarded_to": str(advanced) if advanced else None,
                            "participant_id": str(departing.id),
                            "reason": reason,
                        },
                    )
                )
        await session.flush()

        seats = await BracketService._seat_replacement(
            session, departing, replacement, matches, reason=reason
        )

        competition_ids = {m.competition_id for m in matches if m.competition_id is not None}
        if departing.competition_id is not None:
            competition_ids.add(departing.competition_id)
        for competition_id in competition_ids:
            session.add(
                CompetitionEvent(
                    competition_id=competition_id,
                    event_type="PARTICIPANT_REPLACED",
                    description=reason,
                    payload={
                        "participant_id": str(departing.id),
                        "replacement_participant_id": str(replacement.id),
                        "reason": reason,
                        "seats": seats,
                        "reopened": reopened,
                        "actor_id": str(actor_id) if actor_id else None,
                    },
                )
            )
        await session.flush()

        return {
            "participant_id": str(departing.id),
            "replacement": {"participant_id": str(replacement.id), "seats": seats},
            "reopened": reopened,
        }

    @staticmethod
    async def replacement_candidates(session: AsyncSession, participant_id: str) -> dict:
        """Who could take this fighter's seat, best first.

        Reads only. The ranking is the whole product here: a клуб that loses a
        fighter almost always has the stand-in, so their own reserve is offered
        before anyone else's, and only then the rest of the field.
        """
        departing = await session.get(Participant, parse_id(participant_id, "participant"))
        if departing is None:
            raise HTTPException(status_code=404, detail="Participant not found")

        others = list(
            await session.scalars(
                select(Participant)
                .where(
                    Participant.tournament_id == departing.tournament_id,
                    Participant.id != departing.id,
                )
                .order_by(Participant.seed.asc().nulls_last(), Participant.created_at.asc())
            )
        )
        athletes = await BracketService._athlete_index(session, others)
        # Who is already in this bracket, and therefore not offerable at all.
        taken = {
            p.id
            for p in others
            if p.competition_id == departing.competition_id and p.status != RESERVE_STATUS
        }

        def rank(candidate: Participant) -> tuple[int, str] | None:
            if candidate.id in taken or candidate.status in OUT_STATUSES:
                return None
            if candidate.status == RESERVE_STATUS:
                same_club = (
                    departing.club_name is not None
                    and candidate.club_name is not None
                    and candidate.club_name.casefold() == departing.club_name.casefold()
                )
                return (0, "SAME_CLUB_RESERVE") if same_club else (1, "RESERVE")
            return (2, "OTHER_COMPETITION")

        ranked: list[tuple[int, Participant, str]] = []
        for candidate in others:
            verdict = rank(candidate)
            if verdict is None:
                continue
            order, why = verdict
            ranked.append((order, candidate, why))
        ranked.sort(key=lambda row: row[0])

        busy: dict[UUID, list[str]] = {}
        for candidate in others:
            if candidate.competition_id is not None and candidate.status not in (
                OUT_STATUSES | {RESERVE_STATUS}
            ):
                busy.setdefault(candidate.id, []).append(str(candidate.competition_id))

        return {
            "participant_id": str(departing.id),
            "competition_id": (
                str(departing.competition_id) if departing.competition_id is not None else None
            ),
            "candidates": [
                {
                    "participant_id": str(candidate.id),
                    "display_name": BracketService._display_name(candidate, athletes, {}),
                    "club_name": candidate.club_name,
                    "status": candidate.status,
                    "reason": why,
                    "busy_in": busy.get(candidate.id, []),
                }
                for _, candidate, why in ranked
            ],
        }

    @staticmethod
    async def _athlete_index(
        session: AsyncSession, participants: list[Participant]
    ) -> dict[UUID, Athlete]:
        athlete_ids = {p.athlete_id for p in participants if p.athlete_id}
        if not athlete_ids:
            return {}
        rows = await session.scalars(select(Athlete).where(Athlete.id.in_(athlete_ids)))
        return {a.id: a for a in rows}

    @staticmethod
    async def _resolve_replacement(
        session: AsyncSession,
        departing: Participant,
        replacement_id: str,
        matches: list[Match],
    ) -> Participant:
        """Check that ``replacement_id`` may take ``departing``'s seat.

        Everything here refuses *before* anything is written, so a rejected
        substitution leaves the fighter still in the draw rather than half
        withdrawn.
        """
        if any(m.status == "FINISHED" or m.winner_id is not None for m in matches):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "ALREADY_FOUGHT",
                    "message": (
                        "Боец уже провёл бой — его место в сетке принадлежит его результатам. "
                        "Снимите его без замены."
                    ),
                },
            )

        replacement = await session.get(Participant, parse_id(replacement_id, "replacement"))
        if replacement is None:
            raise HTTPException(status_code=404, detail="Replacement participant not found")
        if replacement.id == departing.id:
            raise HTTPException(
                status_code=400,
                detail={"code": "SELF_REPLACEMENT", "message": "Боец не может заменить сам себя"},
            )
        if replacement.tournament_id != departing.tournament_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "OTHER_TOURNAMENT",
                    "message": "Заменяющий заявлен на другой турнир",
                },
            )
        if replacement.status in OUT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "REPLACEMENT_IS_OUT",
                    "message": f"Заменяющий сам выбыл ({replacement.status})",
                },
            )
        if replacement.competition_id == departing.competition_id and replacement.status not in {
            RESERVE_STATUS
        }:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ALREADY_IN_COMPETITION",
                    "message": "Заменяющий уже участвует в этой дисциплине",
                },
            )

        competition = (
            await session.get(Competition, departing.competition_id)
            if departing.competition_id is not None
            else None
        )
        if competition is not None:
            tournament = await session.get(Tournament, departing.tournament_id)
            event_year = (
                tournament.start_date.year
                if tournament is not None and tournament.start_date is not None
                else datetime.now(timezone.utc).year
            )
            birth_year = replacement.birth_year
            if birth_year is None and replacement.athlete_id is not None:
                athlete = await session.get(Athlete, replacement.athlete_id)
                birth_year = athlete.birth_year if athlete is not None else None
            verdict = eligibility.check_age(
                birth_year,
                min_age=competition.min_age,
                max_age=competition.max_age,
                event_year=event_year,
            )
            if not verdict.ok:
                raise HTTPException(
                    status_code=400,
                    detail={"code": "AGE_OUT_OF_BOUNDS", "message": verdict.message},
                )
        return replacement

    @staticmethod
    async def _seat_replacement(
        session: AsyncSession,
        departing: Participant,
        replacement: Participant,
        matches: list[Match],
        *,
        reason: str,
    ) -> list[dict]:
        """Move the replacement into every bout the departed had not fought.

        The bracket is not rebuilt: the same rows are updated in place, so match
        ids, numbering and everything already announced survive untouched.
        """
        replacement.competition_id = departing.competition_id
        replacement.category_id = departing.category_id
        # The seat carries the seed and the subgroup with it, or a group table
        # would silently lose a row.
        replacement.seed = departing.seed
        replacement.group_id = departing.group_id
        replacement.replaces_participant_id = departing.id
        if replacement.status != "REGISTERED":
            session.add(
                ParticipantStatusHistory(
                    participant_id=replacement.id,
                    from_status=replacement.status,
                    to_status="REGISTERED",
                    reason=reason,
                )
            )
            replacement.status = "REGISTERED"

        seats: list[dict] = []
        for match in matches:
            if match.status not in PENDING_STATUSES:
                continue
            if match.participant_red_id == departing.id:
                match.participant_red_id = replacement.id
            elif match.participant_blue_id == departing.id:
                match.participant_blue_id = replacement.id
            else:
                continue
            seats.append({"match_id": str(match.id), "stage": match.stage_name})
        await session.flush()
        return seats

    @staticmethod
    async def withdraw_participant(
        session: AsyncSession,
        participant_id: str,
        *,
        reason: str,
        to_status: str = "WITHDRAWN",
        actor_id: UUID | None = None,
        replacement_participant_id: str | None = None,
    ) -> dict:
        """Take a fighter out of a competition that is already under way.

        Deliberately **not** a regeneration. Rebuilding the draw would rewrite
        pairings that were already announced and, worse, invalidate bouts that
        really happened, which the documentation forbids. So the structure is
        left exactly as it is — same match ids, same numbering — and every bout
        of theirs that has not been fought is settled as a walkover for the
        opponent, which is how a real tournament handles it.

        Group bouts need no special case: they are ordinary matches whose
        ``next_match_id`` is ``None``, so the walkover is recorded and nothing
        advances.
        """
        if to_status not in OUT_STATUSES:
            raise HTTPException(status_code=400, detail=f"Unsupported withdrawal status: {to_status}")

        participant = await session.get(Participant, parse_id(participant_id, "participant"))
        if participant is None:
            raise HTTPException(status_code=404, detail="Participant not found")
        if participant.status in OUT_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f"Participant is already out of the draw ({participant.status})",
            )

        matches = list(
            await session.scalars(
                select(Match)
                .where(
                    (Match.participant_red_id == participant.id)
                    | (Match.participant_blue_id == participant.id)
                )
                .order_by(Match.round_number.asc().nulls_last(), Match.position.asc().nulls_last())
            )
        )

        in_flight = [m for m in matches if m.status in IN_FLIGHT_STATUSES]
        if in_flight:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "BOUT_IN_FLIGHT",
                    "message": (
                        "У бойца есть начатый бой — судья должен завершить или отменить его, "
                        "иначе уже брошенный жребий будет переписан"
                    ),
                    "match_ids": [str(m.id) for m in in_flight],
                },
            )

        # Resolved before anything is written: a refused substitution must
        # leave the fighter still in the draw, not half withdrawn.
        replacement = (
            await BracketService._resolve_replacement(
                session, participant, replacement_participant_id, matches
            )
            if replacement_participant_id is not None
            else None
        )

        from_status = participant.status
        participant.status = to_status
        session.add(
            ParticipantStatusHistory(
                participant_id=participant.id,
                from_status=from_status,
                to_status=to_status,
                reason=reason,
            )
        )
        await session.flush()

        walkovers: list[dict] = []
        deferred: list[dict] = []
        seats: list[dict] = []

        if replacement is not None:
            # Somebody is taking the seat, so there is no unfought bout to
            # award: the opponent gets a fight, not a free pass.
            seats = await BracketService._seat_replacement(
                session, participant, replacement, matches, reason=reason
            )

        for match in [] if replacement is not None else matches:
            if match.status not in PENDING_STATUSES:
                continue  # a finished bout stays exactly as it was fought
            opponent_id = (
                match.participant_blue_id
                if match.participant_red_id == participant.id
                else match.participant_red_id
            )
            if opponent_id is None:
                # The opponent is not known yet, so there is nobody to award the
                # bout to. Settled later by `_walkover_if_opponent_out`, the
                # moment a winner is seated opposite them.
                deferred.append({"match_id": str(match.id), "stage": match.stage_name})
                continue
            await BracketService._record_walkover(
                session, match, winner_id=opponent_id, loser=participant, reason=reason
            )
            walkovers.append(
                {
                    "match_id": str(match.id),
                    "stage": match.stage_name,
                    "opponent_id": str(opponent_id),
                }
            )

        competition_ids = {m.competition_id for m in matches if m.competition_id is not None}
        if participant.competition_id is not None:
            competition_ids.add(participant.competition_id)
        event_type = "PARTICIPANT_WITHDRAWN" if to_status == "WITHDRAWN" else "PARTICIPANT_DISQUALIFIED"
        for competition_id in competition_ids:
            session.add(
                CompetitionEvent(
                    competition_id=competition_id,
                    event_type=event_type,
                    description=reason,
                    payload={
                        "participant_id": str(participant.id),
                        "from_status": from_status,
                        "to_status": to_status,
                        "reason": reason,
                        "walkovers": walkovers,
                        "pending_walkovers": deferred,
                        "actor_id": str(actor_id) if actor_id else None,
                    },
                )
            )
            # A second entry rather than a flag on the first: the substitution
            # is its own fact, and the journal is read as a list of what
            # happened, not a list of things to inspect for flags.
            if replacement is not None:
                session.add(
                    CompetitionEvent(
                        competition_id=competition_id,
                        event_type="PARTICIPANT_REPLACED",
                        description=reason,
                        payload={
                            "participant_id": str(participant.id),
                            "replacement_participant_id": str(replacement.id),
                            "reason": reason,
                            "seats": seats,
                            "actor_id": str(actor_id) if actor_id else None,
                        },
                    )
                )
        await session.flush()

        return {
            "participant_id": str(participant.id),
            "from_status": from_status,
            "to_status": to_status,
            "reason": reason,
            "walkovers": walkovers,
            "pending_walkovers": deferred,
            "replacement": (
                {"participant_id": str(replacement.id), "seats": seats}
                if replacement is not None
                else None
            ),
        }

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
