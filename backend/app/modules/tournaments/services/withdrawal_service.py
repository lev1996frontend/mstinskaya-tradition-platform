"""Pulling a fighter back out of a bracket that is already under way, and
putting a replacement in their place.

Split out of ``bracket_service.py``'s "withdrawal" section. Depends on
:mod:`bracket_service` (for :meth:`BracketService._competition` /
:meth:`BracketService._display_name`, the read helpers every bracket module
shares) and on :mod:`advancement_service` (to award and propagate the
walkovers a withdrawal creates) — but nothing in either of those imports this
module, so there is no cycle.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete
from app.modules.tournaments.domain import eligibility
from app.modules.tournaments.models import (
    Competition,
    CompetitionEvent,
    Match,
    MatchResult,
    Participant,
    ParticipantStatusHistory,
    Tournament,
)
from app.modules.tournaments.services.advancement_service import AdvancementService
from app.modules.tournaments.services.bracket_common import (
    IN_FLIGHT_STATUSES,
    OUT_STATUSES,
    PENDING_STATUSES,
    RESERVE_STATUS,
    WALKOVER_RESULT_TYPE,
    parse_id,
    ready_status,
)
from app.modules.tournaments.services.bracket_service import BracketService


class WithdrawalService:
    @staticmethod
    async def _unseat(session: AsyncSession, match: Match, participant_id: UUID) -> Match | None:
        """Take ``participant_id`` back out of the round ``match`` sent them to.

        The mirror image of :meth:`AdvancementService.advance_winner`, and
        deliberately as narrow: it clears exactly the slot that advancement
        filled, and only while the target bout has not begun. Anything wider
        would be a rebuild.
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

        replacement = await WithdrawalService._resolve_replacement(
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
                await WithdrawalService._unseat(session, match, advanced)
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

        seats = await WithdrawalService._seat_replacement(
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
        athletes = await WithdrawalService._athlete_index(session, others)
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
            await WithdrawalService._resolve_replacement(
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
            seats = await WithdrawalService._seat_replacement(
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
            await AdvancementService._record_walkover(
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
