"""Entry lists arriving as a file: what is checked, and what is entered.

The organizer downloads a blank, fills it in, uploads it back, reads a per-row
report, fixes what is wrong, and only then commits. Three properties matter and
each is a deliberate choice here:

* **One definition of the columns.** ``IMPORT_COLUMNS`` in :mod:`.intake.columns`
  is walked by every blank writer and every parser, so the file the organizer is
  handed and the file the server expects cannot drift apart — in either format.
  The round-trip tests prove it once per format.
* **Nothing is written by the preview.** Validation reads the database — it has
  to, to spot a duplicate or an unknown discipline — but never writes to it.
* **The commit re-validates.** It takes rows, not the file again, because the
  organizer may have corrected a discipline or a birth year in the review table;
  re-parsing would throw those edits away. Which means the submitted rows are
  client-supplied, so they go through the identical validator a second time.

Which file format a заявка arrived in stops mattering above :mod:`.intake`: a
spreadsheet and a Word document both become the same rows, and everything below
this line judges rows. Names are re-exported here so the router and the tests
keep one import site.
"""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# The athletes domain is reached through its service, not its model — the name
# resolution this needs lives there (`docs/architecture.md`: a module talks to
# another module's service layer).
from app.modules.athletes.services.athlete_service import AthleteService
from app.modules.tournaments.domain import eligibility
from app.modules.tournaments.models import (
    Competition,
    CompetitionEvent,
    Participant,
    Tournament,
    TournamentCategory,
)
from app.modules.tournaments.services.intake import (
    EXAMPLE_MARKER,
    IMPORT_COLUMNS,
    MAX_DATA_ROWS,
    MAX_TOTAL_UPLOAD_BYTES,
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_FILES,
    RESERVE_NO,
    RESERVE_YES,
    SHEET_ENTRIES,
    ImportColumn,
    ParsedSheet,
    RawRow,
    build_template_document,
    build_template_workbook,
    parse_entry_file,
    parse_workbook,
)
from app.modules.tournaments.services.intake.columns import normalize as _normalize
from app.modules.tournaments.services.intake.columns import text as _text

__all__ = [
    "EXAMPLE_MARKER",
    "IMPORT_COLUMNS",
    "MAX_DATA_ROWS",
    "MAX_TOTAL_UPLOAD_BYTES",
    "MAX_UPLOAD_BYTES",
    "MAX_UPLOAD_FILES",
    "RESERVE_NO",
    "RESERVE_YES",
    "SHEET_ENTRIES",
    "ImportColumn",
    "ParsedSheet",
    "ParticipantImportService",
    "RawRow",
    "build_template_document",
    "build_template_workbook",
    "parse_entry_file",
    "parse_workbook",
]

# ------------------------------------------------------------- the validation


class ParticipantImportService:
    @staticmethod
    async def _competitions(session: AsyncSession, tournament: Tournament) -> list[Competition]:
        """The disciplines a заявка may name, in the order they were created.

        Both blanks list them and the validator matches against them, so all
        three read the same query rather than three subtly different ones.
        """
        return list(
            await session.scalars(
                select(Competition)
                .where(Competition.tournament_id == tournament.id)
                .order_by(Competition.created_at.asc())
            )
        )

    @staticmethod
    async def template(session: AsyncSession, tournament: Tournament) -> BytesIO:
        return build_template_workbook(await ParticipantImportService._competitions(session, tournament))

    @staticmethod
    async def word_template(session: AsyncSession, tournament: Tournament) -> BytesIO:
        return build_template_document(
            tournament, await ParticipantImportService._competitions(session, tournament)
        )

    @staticmethod
    async def validate(
        session: AsyncSession,
        tournament: Tournament,
        rows: Iterable[dict],
    ) -> dict:
        """Check every row against the database and report, writing nothing.

        Errors accumulate per row rather than short-circuiting: an organizer
        fixing a spreadsheet needs to see every problem in one pass, not
        discover the next one on each re-upload.
        """
        competitions = list(
            await session.scalars(
                select(Competition)
                .where(Competition.tournament_id == tournament.id)
                .order_by(Competition.created_at.asc())
            )
        )
        by_name = {_normalize(c.name): c for c in competitions}
        # A category name is accepted as an alias for the discipline that names
        # it, since the organizer's spreadsheet may well use either.
        categories = list(
            await session.scalars(
                select(TournamentCategory).where(TournamentCategory.tournament_id == tournament.id)
            )
        )
        category_to_competition = {
            _normalize(category.name): competition
            for category in categories
            for competition in competitions
            if competition.category_id == category.id
        }

        # Through the athletes module's own service, which brings each profile's
        # person along with it — the ФИО lives on the user account, not on the
        # athlete row.
        athletes = await AthleteService.list_athletes(session)
        athlete_by_nickname = {_normalize(a.nickname): a for a in athletes if a.nickname}
        # …and by real name, which is what a заявка actually carries. Matching on
        # nickname alone meant a fighter with no боевое имя — or one whose
        # spreadsheet row simply gives their ФИО — linked to no profile at all
        # and was entered as a brand-new person, which is the duplicate identity
        # this import is supposed to prevent. A nickname still wins where both
        # match: it is the more specific claim.
        athlete_by_full_name = {}
        for candidate in athletes:
            full_name = AthleteService.full_name_of(candidate)
            if full_name:
                athlete_by_full_name.setdefault(_normalize(full_name), candidate)

        existing = list(
            await session.scalars(
                select(Participant).where(Participant.tournament_id == tournament.id)
            )
        )
        existing_by_athlete = {
            (p.competition_id, p.athlete_id) for p in existing if p.athlete_id is not None
        }
        existing_by_name = {
            (p.competition_id, _normalize(p.display_name)) for p in existing if p.display_name
        }

        event_year = (
            tournament.start_date.year
            if tournament.start_date is not None
            else datetime.now(timezone.utc).year
        )

        seen_in_file: set[tuple[UUID | None, str]] = set()
        #: A separate key for a row that resolved to a profile: the same fighter
        #: can appear under a драковое имя in one row and their ФИО in another,
        #: which are different strings and so invisible to the name key above —
        #: exactly the duplicate identity linking to ``athlete_id`` exists to rule
        #: out. Rows with no resolved profile still rely on the name key alone.
        seen_athlete_in_file: set[tuple[UUID, UUID]] = set()
        unknown_categories: set[str] = set()
        reported: list[dict] = []

        for index, raw in enumerate(rows, start=1):
            values = {column.key: _text(raw.get(column.key)) for column in IMPORT_COLUMNS}
            row_number = int(raw.get("row_number") or index)
            source_file = _text(raw.get("source_file")) or None
            errors: list[dict] = []

            full_name = values["full_name"]
            if not full_name:
                errors.append(
                    {"code": "MISSING_NAME", "column": "full_name", "message": "Не указано ФИО"}
                )

            category_text = values["category"]
            competition = by_name.get(_normalize(category_text)) or category_to_competition.get(
                _normalize(category_text)
            )
            if competition is None:
                unknown_categories.add(category_text or "—")
                errors.append(
                    {
                        "code": "UNKNOWN_CATEGORY",
                        "column": "category",
                        "message": (
                            f"«{category_text}» не совпадает ни с одной дисциплиной турнира"
                            if category_text
                            else "Не указана дисциплина"
                        ),
                    }
                )

            birth_year: int | None = None
            if values["birth_year"]:
                try:
                    birth_year = int(values["birth_year"])
                except ValueError:
                    errors.append(
                        {
                            "code": "INVALID_BIRTH_YEAR",
                            "column": "birth_year",
                            "message": "Год рождения должен быть числом",
                        }
                    )
                else:
                    if not 1900 <= birth_year <= event_year:
                        errors.append(
                            {
                                "code": "INVALID_BIRTH_YEAR",
                                "column": "birth_year",
                                "message": f"Год рождения вне диапазона 1900–{event_year}",
                            }
                        )
                        birth_year = None

            seed: int | None = None
            if values["seed"]:
                try:
                    seed = int(values["seed"])
                except ValueError:
                    seed = None
                if seed is None or seed < 1:
                    errors.append(
                        {
                            "code": "INVALID_SEED",
                            "column": "seed",
                            "message": "Посев должен быть целым числом от 1",
                        }
                    )
                    seed = None

            reserve = False
            marked = _normalize(values["reserve"])
            if marked in RESERVE_YES:
                reserve = True
            elif marked not in RESERVE_NO:
                errors.append(
                    {
                        "code": "INVALID_RESERVE",
                        "column": "reserve",
                        "message": "В колонке «Запасной» пишут «да» или оставляют пусто",
                    }
                )

            # A fight name is the better match key: it is what a fighter is
            # actually known by, and what the roster shows. Then the ФИО, against
            # nicknames and against real names both — a spreadsheet may put
            # either in either column.
            athlete = (
                athlete_by_nickname.get(_normalize(values["fight_name"]))
                or athlete_by_nickname.get(_normalize(full_name))
                or athlete_by_full_name.get(_normalize(full_name))
                or athlete_by_full_name.get(_normalize(values["fight_name"]))
            )

            if competition is not None:
                if birth_year is None and values["birth_year"] == "" and athlete is not None:
                    birth_year = athlete.birth_year
                verdict = eligibility.check_age(
                    birth_year,
                    min_age=competition.min_age,
                    max_age=competition.max_age,
                    event_year=event_year,
                )
                if not verdict.ok:
                    errors.append(
                        {"code": verdict.code, "column": "birth_year", "message": verdict.message}
                    )

                key = (competition.id, _normalize(values["fight_name"] or full_name))
                athlete_key = (competition.id, athlete.id) if athlete is not None else None
                duplicate_in_file = key in seen_in_file or (
                    athlete_key is not None and athlete_key in seen_athlete_in_file
                )
                if duplicate_in_file:
                    errors.append(
                        {
                            "code": "DUPLICATE_IN_FILE",
                            "column": "full_name",
                            "message": "Этот боец уже есть в файле в той же дисциплине",
                        }
                    )
                seen_in_file.add(key)
                if athlete_key is not None:
                    seen_athlete_in_file.add(athlete_key)

                already = (
                    athlete is not None and (competition.id, athlete.id) in existing_by_athlete
                ) or (competition.id, _normalize(full_name)) in existing_by_name
                if already:
                    errors.append(
                        {
                            "code": "DUPLICATE_IN_COMPETITION",
                            "column": "full_name",
                            "message": "Этот боец уже заявлен в этой дисциплине",
                        }
                    )

            reported.append(
                {
                    "row_number": row_number,
                    "source_file": source_file,
                    "full_name": full_name,
                    "fight_name": values["fight_name"] or None,
                    "city": values["city"] or None,
                    "club": values["club"] or None,
                    "category": category_text or None,
                    "birth_year": birth_year,
                    "seed": seed,
                    "reserve": reserve,
                    "competition_id": str(competition.id) if competition else None,
                    "competition_name": competition.name if competition else None,
                    "athlete_id": str(athlete.id) if athlete else None,
                    # What to call the profile that was matched: the боевое имя
                    # if there is one, otherwise the ФИО — never nothing, or the
                    # review screen claims a link it cannot name.
                    "athlete_display_name": (
                        (athlete.nickname or AthleteService.full_name_of(athlete)) if athlete else None
                    ),
                    # Пусто — в сетке ФИО. Many fighters have no fight name.
                    "display_name": values["fight_name"] or full_name,
                    "errors": errors,
                    "valid": not errors,
                }
            )

        return {
            "tournament_id": str(tournament.id),
            "columns": [
                {
                    "key": column.key,
                    "header_ru": column.header_ru,
                    "required": column.required,
                    "note": column.note,
                }
                for column in IMPORT_COLUMNS
            ],
            "competitions": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "age_label": eligibility.describe_bounds(c.min_age, c.max_age),
                }
                for c in competitions
            ],
            "total_rows": len(reported),
            "valid_rows": sum(1 for row in reported if row["valid"]),
            "rows": reported,
            "unknown_categories": sorted(unknown_categories),
        }

    @staticmethod
    async def commit(
        session: AsyncSession,
        tournament: Tournament,
        rows: Iterable[dict],
        *,
        actor_id: UUID | None = None,
    ) -> dict:
        """Enter the submitted rows, refusing the batch if any of them is bad.

        Re-validates rather than trusting the preview: what arrives here is
        whatever the browser sent, possibly edited after the preview ran, and a
        client is never the authority on whether a row is admissible.

        All or nothing. A half-imported entry list is worse than a rejected one
        — the organizer cannot tell which half landed without reading the roster
        row by row.
        """
        from app.modules.tournaments.services.engine_service import TournamentEngineService

        report = await ParticipantImportService.validate(session, tournament, rows)
        if report["valid_rows"] != report["total_rows"]:
            raise HTTPException(status_code=400, detail=report)
        if report["total_rows"] == 0:
            raise HTTPException(status_code=400, detail="В заявке нет строк")

        per_competition: dict[str, int] = {}
        for row in report["rows"]:
            await TournamentEngineService.create_participant(
                session,
                competition_id=row["competition_id"],
                athlete_id=row["athlete_id"],
                display_name=row["display_name"],
                city=row["city"],
                club_name=row["club"],
                birth_year=row["birth_year"],
                seed=row["seed"],
                # A reserve is entered on the roster but stays out of the draw
                # until an organizer puts them in someone's place.
                status="RESERVE" if row.get("reserve") else "REGISTERED",
            )
            name = row["competition_name"] or row["competition_id"]
            per_competition[name] = per_competition.get(name, 0) + 1

        for competition_id in {row["competition_id"] for row in report["rows"]}:
            session.add(
                CompetitionEvent(
                    competition_id=UUID(competition_id),
                    event_type="PARTICIPANTS_IMPORTED",
                    description=f"Заявки загружены из файла: {report['total_rows']}",
                    payload={
                        "created": report["total_rows"],
                        "per_competition": per_competition,
                        "actor_id": str(actor_id) if actor_id else None,
                    },
                )
            )
        await session.flush()

        return {
            "tournament_id": str(tournament.id),
            "created": report["total_rows"],
            "per_competition": per_competition,
        }
