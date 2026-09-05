"""Cutting a too-wide category into age streams.

An «Абсолютная детская» that holds both an eight-year-old and a fourteen-year-
old is not one field. Given the discipline's ``max_age_gap`` and the entrants
who actually turned up, this works out the streams and, on request, turns them
into real disciplines.

The split makes siblings rather than children: the competition being split
*becomes* the youngest stream, and one new competition is created per further
stream. That is deliberate — every downstream mechanism (bracket, group stage,
lot, withdrawal, champion) already works on a competition, so a stream is
simply a competition and nothing below has to learn a new idea. It also leaves
no orphaned parent standing around with an empty roster.

Nothing here decides a rule. ``max_age_gap`` comes from the organizer, the
stream boundaries follow arithmetically from it, and a stream left holding one
fighter is reported rather than quietly folded into its neighbour — folding it
would break the very rule the gap expresses.
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
    Participant,
    Tournament,
)
from app.modules.tournaments.services.bracket_service import parse_id


class AgeSplitService:
    @staticmethod
    async def _competition(session: AsyncSession, competition_id: str) -> Competition:
        item = await session.get(Competition, parse_id(competition_id, "competition"))
        if item is None:
            raise HTTPException(status_code=404, detail="Competition not found")
        return item

    @staticmethod
    async def _event_year(session: AsyncSession, competition: Competition) -> int:
        tournament = await session.get(Tournament, competition.tournament_id)
        if tournament is not None and tournament.start_date is not None:
            return tournament.start_date.year
        return datetime.now(timezone.utc).year

    @staticmethod
    async def _entrants(
        session: AsyncSession, competition: Competition
    ) -> tuple[list[Participant], dict[UUID, int]]:
        """Active entries, and the age each of them reaches in the event year.

        A birth year on the entry wins; a linked athlete profile is the
        fallback, so someone entered from an existing profile does not have to
        repeat it.
        """
        participants = [
            p
            for p in await session.scalars(
                select(Participant)
                .where(Participant.competition_id == competition.id)
                .order_by(Participant.created_at.asc())
            )
            if p.status not in {"WITHDRAWN", "DISQUALIFIED"}
        ]

        missing_year = {p.athlete_id for p in participants if p.birth_year is None and p.athlete_id}
        from_profile: dict[UUID, int | None] = {}
        if missing_year:
            rows = await session.scalars(select(Athlete).where(Athlete.id.in_(missing_year)))
            from_profile = {a.id: a.birth_year for a in rows}

        event_year = await AgeSplitService._event_year(session, competition)
        ages: dict[UUID, int] = {}
        for participant in participants:
            year = participant.birth_year
            if year is None and participant.athlete_id:
                year = from_profile.get(participant.athlete_id)
            if year is not None:
                ages[participant.id] = eligibility.age_in_year(year, event_year)
        return participants, ages

    # ------------------------------------------------------------------ #
    # preview
    # ------------------------------------------------------------------ #

    @staticmethod
    async def preview(session: AsyncSession, competition_id: str) -> dict:
        """The streams this discipline would be cut into. Writes nothing."""
        from app.modules.tournaments.services.read_service import TournamentReadService

        competition = await AgeSplitService._competition(session, competition_id)
        participants, ages = await AgeSplitService._entrants(session, competition)
        views = await TournamentReadService.build_participant_views(session, participants)

        blockers: list[dict] = []
        if competition.max_age_gap is None:
            blockers.append(
                {
                    "code": "NO_AGE_GAP",
                    "message": "У дисциплины не задан допустимый разрыв в возрасте",
                    "ids": [],
                }
            )
        if await session.scalar(select(Match.id).where(Match.competition_id == competition.id)):
            blockers.append(
                {
                    "code": "ALREADY_STARTED",
                    "message": "В дисциплине уже есть бои — делить нужно до жеребьёвки",
                    "ids": [],
                }
            )
        unknown = [p for p in participants if p.id not in ages]
        if unknown:
            blockers.append(
                {
                    "code": "MISSING_BIRTH_YEAR",
                    "message": f"Не указан год рождения: {len(unknown)}",
                    "ids": [str(p.id) for p in unknown],
                }
            )

        bands: list[eligibility.AgeBand] = []
        if competition.max_age_gap is not None and not unknown:
            bands = eligibility.split_into_age_bands(
                [(str(p.id), ages[p.id]) for p in participants],
                max_gap=competition.max_age_gap,
            )

        spread = (max(ages.values()) - min(ages.values())) if ages else 0
        return {
            "competition_id": str(competition.id),
            "competition_name": competition.name,
            "max_age_gap": competition.max_age_gap,
            "participant_count": len(participants),
            "age_min": min(ages.values()) if ages else None,
            "age_max": max(ages.values()) if ages else None,
            "age_spread": spread,
            # One stream means the field already fits the rule; splitting it
            # would only rename the discipline.
            "split_needed": len(bands) > 1,
            "ready": not blockers and len(bands) > 1,
            "blockers": blockers,
            "bands": [
                {
                    "label": band.label,
                    "name": AgeSplitService._band_name(competition.name, band),
                    "min_age": band.min_age,
                    "max_age": band.max_age,
                    "is_lonely": band.is_lonely,
                    "members": [
                        {
                            "participant_id": pid,
                            "display_name": views[UUID(pid)].display_name
                            if UUID(pid) in views
                            else "—",
                            "age": ages.get(UUID(pid)),
                        }
                        for pid in band.participant_ids
                    ],
                }
                for band in bands
            ],
        }

    @staticmethod
    def _band_name(base: str, band: eligibility.AgeBand) -> str:
        """«Абсолютная детская» + «8–9» → «Абсолютная детская 8–9»."""
        return f"{base.strip()} {band.label}"

    # ------------------------------------------------------------------ #
    # apply
    # ------------------------------------------------------------------ #

    @staticmethod
    async def apply(
        session: AsyncSession,
        competition_id: str,
        *,
        actor_id: UUID | None = None,
    ) -> dict:
        """Turn the streams into real disciplines.

        The competition being split becomes the youngest stream and keeps its
        id, so any link already handed out still resolves; the rest are new
        competitions beside it. Each carries the stream's own ``min_age`` /
        ``max_age``, so a late entry lands in the right one and the ordinary
        age check does the rest.
        """
        competition = await AgeSplitService._competition(session, competition_id)
        state = await AgeSplitService.preview(session, str(competition.id))
        if state["blockers"]:
            raise HTTPException(status_code=409, detail={"blockers": state["blockers"]})
        if not state["split_needed"]:
            raise HTTPException(
                status_code=400,
                detail="Разброс в возрасте укладывается в допустимый — делить нечего",
            )

        base_name = competition.name
        bands = state["bands"]
        created: list[dict] = []

        for index, band in enumerate(bands):
            if index == 0:
                target = competition
                target.name = band["name"]
            else:
                target = Competition(
                    tournament_id=competition.tournament_id,
                    name=band["name"],
                    description=competition.description,
                    category_id=competition.category_id,
                    competition_type=competition.competition_type,
                    format=competition.format,
                    status=competition.status,
                    max_age_gap=competition.max_age_gap,
                )
                session.add(target)
                await session.flush()

            target.min_age = band["min_age"]
            target.max_age = band["max_age"]

            for member in band["members"]:
                participant = await session.get(Participant, UUID(member["participant_id"]))
                if participant is not None:
                    participant.competition_id = target.id
            created.append(
                {
                    "competition_id": str(target.id),
                    "name": target.name,
                    "label": band["label"],
                    "min_age": band["min_age"],
                    "max_age": band["max_age"],
                    "participant_count": len(band["members"]),
                    "is_lonely": band["is_lonely"],
                }
            )
            session.add(
                CompetitionEvent(
                    competition_id=target.id,
                    event_type="AGE_BANDS_SPLIT",
                    description=(
                        f"«{base_name}» разделена по возрасту: поток {band['label']}, "
                        f"бойцов {len(band['members'])}"
                    ),
                    payload={
                        "source_competition_id": str(competition.id),
                        "source_name": base_name,
                        "max_age_gap": competition.max_age_gap,
                        "band": band["label"],
                        "bands": [b["label"] for b in bands],
                        "participant_ids": [m["participant_id"] for m in band["members"]],
                        "is_lonely": band["is_lonely"],
                        "actor_id": str(actor_id) if actor_id else None,
                    },
                )
            )

        await session.flush()
        return {
            "source_name": base_name,
            "max_age_gap": competition.max_age_gap,
            "competitions": created,
        }
