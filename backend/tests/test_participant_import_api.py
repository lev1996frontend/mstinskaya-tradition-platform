"""Entry lists arriving as a spreadsheet.

The load-bearing test here is the round trip: download the template, fill it
in, upload it back. That is the machine-checkable form of "the template and the
parser cannot drift apart", which is the whole reason both read one column
definition.

The rest pin down that the preview writes nothing, that the commit re-validates
what the browser sends rather than trusting it, and one error case per code.
"""

import asyncio
from datetime import date
from io import BytesIO

from fastapi.testclient import TestClient
from docx import Document
from openpyxl import Workbook, load_workbook
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import database as database_module
from app.main import app
from app.models.base import Base
from app.modules.tournaments.services.participant_import import IMPORT_COLUMNS, SHEET_ENTRIES
from tests.auth_test_helpers import snapshot_session, use_session

EVENT_YEAR = 2026
START_DATE = date(EVENT_YEAR, 5, 16).isoformat()
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def setup_app_for_tests():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    database_module.engine = engine
    database_module.AsyncSessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def setup_db() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(setup_db())

    def override_get_db():
        async def _override():
            async with database_module.AsyncSessionLocal() as session:
                yield session

        return _override

    app.dependency_overrides[database_module.get_db] = override_get_db()
    return TestClient(app)


def register(client, email: str) -> tuple[str, dict[str, str]]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": "Иван", "last_name": "Организатор"},
    )
    assert response.status_code == 201, response.text
    session = snapshot_session(client)
    me = client.get("/api/v1/users/me")
    return me.json()["id"], session


def register_athlete(client, email: str, nickname: str, first_name: str, last_name: str) -> str:
    """A user with an athlete profile — драковое имя and ФИО both resolvable."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "first_name": first_name, "last_name": last_name},
    )
    assert response.status_code == 201, response.text
    user_id = client.get("/api/v1/users/me").json()["id"]
    athlete = client.post("/api/v1/athletes", json={"user_id": user_id, "nickname": nickname})
    assert athlete.status_code == 201, athlete.text
    return athlete.json()["id"]


def bootstrap(client):
    """A tournament with three disciplines, one of them age-bounded."""
    organizer_id, headers = register(client, "organizer@example.com")
    ruleset = client.post("/api/v1/rulesets", json={"title": "Base", "version": "1.0", "status": "ACTIVE"})
    tournament = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Мстинская традиция 2026",
            "status": "REGISTRATION",
            "start_date": START_DATE,
            "organizer_id": organizer_id,
            "ruleset_id": ruleset.json()["id"],
        },
    )
    assert tournament.status_code == 201, tournament.text
    tournament_id = tournament.json()["id"]

    for name, extra in (
        ("Абсолютная мужская", {}),
        ("Абсолютная ветеранская", {"min_age": 45}),
        ("Абсолютная детская", {"max_age": 14}),
    ):
        created = client.post(
            f"/api/v1/tournaments/{tournament_id}/competitions",
            json={
                "tournament_id": tournament_id,
                "name": name,
                "type": "INDIVIDUAL",
                "format": "SINGLE_ELIMINATION",
                "status": "REGISTRATION",
                **extra,
            },
        )
        assert created.status_code == 201, created.text
    return tournament_id, headers


def sheet_of(rows: list[dict]) -> bytes:
    """Build an .xlsx the way an organizer would, from the real headers."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_ENTRIES
    sheet.append([column.header_ru for column in IMPORT_COLUMNS])
    for row in rows:
        sheet.append([row.get(column.key, "") for column in IMPORT_COLUMNS])
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def preview(client, tournament_id: str, payload: bytes, session: dict[str, str]):
    use_session(client, session)
    return client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/preview",
        files={"file": ("entries.xlsx", payload, XLSX)},
    )


def participants(client, tournament_id: str) -> list[dict]:
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    everyone: list[dict] = []
    for competition in competitions:
        everyone += client.get(f"/api/v1/competitions/{competition['id']}/participants").json()
    return everyone


# --------------------------------------------------------------- round trip


def test_the_template_can_be_filled_in_and_uploaded_back():
    """The anti-drift guarantee, checked rather than asserted in a comment."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    downloaded = client.get(f"/api/v1/tournaments/{tournament_id}/participants/template.xlsx")
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.headers["content-type"].startswith(XLSX)

    workbook = load_workbook(BytesIO(downloaded.content))
    sheet = workbook[SHEET_ENTRIES]
    headers_row = [cell.value for cell in sheet[1]]
    assert headers_row == [column.header_ru for column in IMPORT_COLUMNS]

    # The second sheet tells the organizer which category names are accepted.
    reference = workbook["Дисциплины"]
    names = [row[0] for row in reference.iter_rows(min_row=2, values_only=True)]
    assert "Абсолютная ветеранская" in names

    # Fill the downloaded file in and send it straight back.
    sheet.append(["Замятин Пётр", "Кистень", "Новгород", "Буза", "Абсолютная ветеранская", EVENT_YEAR - 50, ""])
    filled = BytesIO()
    workbook.save(filled)

    report = preview(client, tournament_id, filled.getvalue(), headers)
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["total_rows"] == 1, body["rows"]
    assert body["valid_rows"] == 1
    assert body["rows"][0]["competition_name"] == "Абсолютная ветеранская"


def test_the_template_shows_a_filled_in_example_that_it_then_ignores():
    """The template teaches by example instead of by a validation error later.

    The examples have to survive the round trip as *examples*: an organizer who
    fills in their own rows underneath and uploads the file back must not find
    Замятин Пётр entered into their tournament.
    """
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    downloaded = client.get(f"/api/v1/tournaments/{tournament_id}/participants/template.xlsx")
    assert downloaded.status_code == 200, downloaded.text
    workbook = load_workbook(BytesIO(downloaded.content))
    sheet = workbook[SHEET_ENTRIES]

    filled = [
        [cell.value for cell in row]
        for row in sheet.iter_rows(min_row=1)
        if any(cell.value not in (None, "") for cell in row)
    ]
    assert len(filled) >= 4, "header, notes and at least two example rows"

    report = preview(client, tournament_id, downloaded.content, headers).json()
    assert report["total_rows"] == 0, report["rows"]


def test_an_entry_marked_as_a_reserve_is_entered_as_one():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    payload = sheet_of(
        [
            {"full_name": "Основной", "category": "Абсолютная мужская"},
            {"full_name": "Запасной", "category": "Абсолютная мужская", "reserve": "да"},
        ]
    )
    report = preview(client, tournament_id, payload, headers).json()
    assert report["valid_rows"] == 2, report["rows"]

    committed = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
    )
    assert committed.status_code == 200, committed.text

    by_name = {row["display_name"]: row for row in participants(client, tournament_id)}
    assert by_name["Основной"]["status"] == "REGISTERED"
    assert by_name["Запасной"]["status"] == "RESERVE"


# ------------------------------------------------------- preview writes nothing


def test_the_preview_persists_nothing():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    payload = sheet_of(
        [{"full_name": "Иван Иванов", "category": "Абсолютная мужская", "city": "Псков"}]
    )
    assert preview(client, tournament_id, payload, headers).json()["valid_rows"] == 1
    assert participants(client, tournament_id) == []


# ---------------------------------------------------------------- the commit


def test_a_reviewed_list_is_entered_and_journalled():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    payload = sheet_of(
        [
            {
                "full_name": "Замятин Пётр",
                "fight_name": "Кистень",
                "city": "Новгород",
                "club": "Буза",
                "category": "Абсолютная мужская",
                "seed": 1,
            },
            {"full_name": "Сергеев Сергей", "city": "Псков", "category": "Абсолютная мужская"},
        ]
    )
    report = preview(client, tournament_id, payload, headers).json()
    assert report["valid_rows"] == 2

    committed = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
    )
    assert committed.status_code == 200, committed.text
    assert committed.json()["created"] == 2
    assert committed.json()["per_competition"] == {"Абсолютная мужская": 2}

    entered = participants(client, tournament_id)
    by_name = {row["display_name"]: row for row in entered}
    # Драковое имя wins where there is one; ФИО where there is not.
    assert set(by_name) == {"Кистень", "Сергеев Сергей"}
    assert by_name["Кистень"]["club_name"] == "Буза"
    assert by_name["Кистень"]["city"] == "Новгород"
    assert by_name["Кистень"]["seed"] == 1

    competition_id = by_name["Кистень"]["competition_id"]
    journal = client.get(f"/api/v1/competitions/{competition_id}/events").json()
    assert [e for e in journal if e["event_type"] == "PARTICIPANTS_IMPORTED"]


def test_the_commit_revalidates_what_the_browser_sends():
    """A row edited to something invalid after the preview is still refused."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    payload = sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])
    report = preview(client, tournament_id, payload, headers).json()
    assert report["valid_rows"] == 1

    tampered = report["rows"][0] | {"category": "Абсолютная ветеранская", "birth_year": EVENT_YEAR - 20}
    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": [tampered]},
    )
    assert refused.status_code == 400, refused.text
    assert participants(client, tournament_id) == []


def test_a_batch_with_one_bad_row_is_refused_whole():
    """Half an entry list is worse than none — the organizer cannot tell which half."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    payload = sheet_of(
        [
            {"full_name": "Хороший", "category": "Абсолютная мужская"},
            {"full_name": "", "category": "Абсолютная мужская"},
        ]
    )
    report = preview(client, tournament_id, payload, headers).json()
    refused = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": report["rows"]},
    )
    assert refused.status_code == 400, refused.text
    assert participants(client, tournament_id) == []


# ------------------------------------------------------------ the error codes


def codes(report: dict, row_index: int = 0) -> set[str]:
    return {error["code"] for error in report["rows"][row_index]["errors"]}


def test_a_missing_name_is_reported():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    report = preview(
        client, tournament_id, sheet_of([{"full_name": "", "category": "Абсолютная ветеранская"}]), headers
    ).json()
    assert "MISSING_NAME" in codes(report)


def test_an_unknown_category_is_reported_once_for_the_file():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    report = preview(
        client,
        tournament_id,
        sheet_of(
            [
                {"full_name": "Первый", "category": "Женская абсолютка"},
                {"full_name": "Второй", "category": "Женская абсолютка"},
            ]
        ),
        headers,
    ).json()
    assert "UNKNOWN_CATEGORY" in codes(report)
    assert report["unknown_categories"] == ["Женская абсолютка"]


def test_the_age_bound_is_checked_on_import_too():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    report = preview(
        client,
        tournament_id,
        sheet_of(
            [
                {"full_name": "Молодой", "category": "Абсолютная ветеранская", "birth_year": EVENT_YEAR - 30},
                {"full_name": "Без года", "category": "Абсолютная ветеранская"},
                {"full_name": "Взрослый", "category": "Абсолютная детская", "birth_year": EVENT_YEAR - 30},
            ]
        ),
        headers,
    ).json()
    assert "AGE_BELOW_MINIMUM" in codes(report, 0)
    assert "MISSING_BIRTH_YEAR" in codes(report, 1)
    assert "AGE_ABOVE_MAXIMUM" in codes(report, 2)


def test_a_bad_year_or_seed_is_reported():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    report = preview(
        client,
        tournament_id,
        sheet_of(
            [
                {
                    "full_name": "Кривой",
                    "category": "Абсолютная мужская",
                    "birth_year": "позапрошлый",
                    "seed": "первый",
                }
            ]
        ),
        headers,
    ).json()
    assert {"INVALID_BIRTH_YEAR", "INVALID_SEED"} <= codes(report)


def test_a_duplicate_inside_the_file_is_reported():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    report = preview(
        client,
        tournament_id,
        sheet_of(
            [
                {"full_name": "Иван Иванов", "category": "Абсолютная мужская"},
                {"full_name": "Иван  Иванов", "category": "Абсолютная мужская"},
            ]
        ),
        headers,
    ).json()
    # The first occurrence is fine; the second is the duplicate.
    assert codes(report, 0) == set()
    assert "DUPLICATE_IN_FILE" in codes(report, 1)


def test_a_duplicate_written_differently_across_rows_is_still_reported():
    """Драковое имя in one row, ФИО in another — same profile, same discipline.

    The name key alone is blind to this: the two rows are different strings.
    What makes them the same entrant is that both resolve to the same athlete
    profile, which is exactly what the duplicate-in-file check has to catch too.
    """
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    register_athlete(client, "petr@example.com", "Кистень", "Пётр", "Замятин")

    report = preview(
        client,
        tournament_id,
        sheet_of(
            [
                {"full_name": "Замятин Пётр", "fight_name": "Кистень", "category": "Абсолютная мужская"},
                {"full_name": "Замятин Пётр", "category": "Абсолютная мужская"},
            ]
        ),
        headers,
    ).json()
    assert codes(report, 0) == set()
    assert "DUPLICATE_IN_FILE" in codes(report, 1)


def test_someone_already_entered_is_reported():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    competitions = client.get(f"/api/v1/tournaments/{tournament_id}/competitions").json()
    absolute = next(c for c in competitions if c["name"] == "Абсолютная мужская")
    client.post(
        f"/api/v1/competitions/{absolute['id']}/participants",
        json={"competition_id": absolute["id"], "display_name": "Иван Иванов"},
    ).raise_for_status()

    report = preview(
        client,
        tournament_id,
        sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}]),
        headers,
    ).json()
    assert "DUPLICATE_IN_COMPETITION" in codes(report)


def test_the_same_person_may_be_entered_in_two_disciplines():
    """Not a duplicate: «Абсолютная ветеранская» and the open absolute are different fields."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    report = preview(
        client,
        tournament_id,
        sheet_of(
            [
                {"full_name": "Замятин Пётр", "category": "Абсолютная ветеранская", "birth_year": EVENT_YEAR - 50},
                {"full_name": "Замятин Пётр", "category": "Абсолютная мужская"},
            ]
        ),
        headers,
    ).json()
    assert report["valid_rows"] == 2, report["rows"]


# -------------------------------------------------------- file-level refusals


def test_a_reordered_sheet_still_imports():
    """Columns are matched by header text, not by position."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_ENTRIES
    sheet.append(["Категория", "Город", "ФИО"])
    sheet.append(["Абсолютная мужская", "Тверь", "Фёдоров Фёдор"])
    stream = BytesIO()
    workbook.save(stream)

    report = preview(client, tournament_id, stream.getvalue(), headers).json()
    assert report["valid_rows"] == 1
    assert report["rows"][0]["full_name"] == "Фёдоров Фёдор"
    assert report["rows"][0]["city"] == "Тверь"


def test_a_file_that_is_not_a_spreadsheet_is_refused_clearly():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    refused = preview(client, tournament_id, b"not a workbook at all", headers)
    assert refused.status_code == 400, refused.text
    assert "xlsx" in refused.json()["detail"].lower()


# ----------------------------------------------------- несколько файлов сразу
# An entry list rarely arrives as one file: each club sends its own. The rules
# below are what makes a stack of them behave like a single заявка.


def preview_files(client, tournament_id: str, uploads, session):
    """Upload several sheets in one request, the way the panel does."""
    use_session(client, session)
    return client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/preview",
        files=[("file", (name, payload, XLSX)) for name, payload in uploads],
    )


def test_several_files_are_reviewed_as_one_entry_list():
    """Two clubs, two files, one report — and each row says where it came from."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    buza = sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])
    sokol = sheet_of(
        [
            {"full_name": "Пётр Петров", "category": "Абсолютная мужская"},
            {"full_name": "Сергей Сергеев", "category": "Абсолютная мужская"},
        ]
    )

    response = preview_files(client, tournament_id, [("buza.xlsx", buza), ("sokol.xlsx", sokol)], headers)
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["total_rows"] == 3
    assert report["valid_rows"] == 3
    assert [row["source_file"] for row in report["rows"]] == [
        "buza.xlsx",
        "sokol.xlsx",
        "sokol.xlsx",
    ]
    assert [(f["name"], f["rows"]) for f in report["files"]] == [("buza.xlsx", 1), ("sokol.xlsx", 2)]


def test_a_fighter_sent_in_two_files_is_reported_as_a_duplicate():
    """Two clubs both claiming the same fighter is the whole point of one report."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    entry = [{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}]

    report = preview_files(
        client,
        tournament_id,
        [("buza.xlsx", sheet_of(entry)), ("sokol.xlsx", sheet_of(entry))],
        headers,
    ).json()

    assert codes(report, 0) == set()
    assert "DUPLICATE_IN_FILE" in codes(report, 1)


def test_one_unreadable_file_does_not_sink_the_others():
    """A coach sending a .doc must not cost the other four clubs their заявка."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    good = sheet_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])

    response = preview_files(
        client,
        tournament_id,
        [("broken.xlsx", b"not a workbook at all"), ("sokol.xlsx", good)],
        headers,
    )
    assert response.status_code == 200, response.text
    report = response.json()

    broken, sokol = report["files"]
    assert broken["name"] == "broken.xlsx"
    assert "xlsx" in (broken["error"] or "").lower()
    assert broken["rows"] == 0
    assert sokol["error"] is None

    assert report["total_rows"] == 1
    assert report["valid_rows"] == 1
    assert report["rows"][0]["source_file"] == "sokol.xlsx"


def test_the_report_says_how_many_example_rows_it_dropped():
    """Silently dropping them was the bug: a row written over an example vanished.

    The count is what lets the panel say «две строки-примера пропущены» instead
    of leaving the organizer to wonder where their fighter went.
    """
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    downloaded = client.get(f"/api/v1/tournaments/{tournament_id}/participants/template.xlsx")
    report = preview_files(client, tournament_id, [("blank.xlsx", downloaded.content)], headers).json()

    assert report["total_rows"] == 0
    assert report["files"][0]["skipped_examples"] == 2


# ------------------------------------------------------------- заявка в ворде
# Some clubs fill in a document rather than a spreadsheet. The blank is the same
# blank — same columns, same «ПРИМЕР:» rows — so nothing below the parser can
# tell the two formats apart, and these tests are what holds that true.


def doc_of(rows: list[dict]) -> bytes:
    """Build a .docx the way an organizer would: the blank's table, filled in."""
    document = Document()
    table = document.add_table(rows=1, cols=len(IMPORT_COLUMNS))
    for cell, column in zip(table.rows[0].cells, IMPORT_COLUMNS):
        cell.text = column.header_ru
    for row in rows:
        cells = table.add_row().cells
        for cell, column in zip(cells, IMPORT_COLUMNS):
            cell.text = str(row.get(column.key, ""))
    stream = BytesIO()
    document.save(stream)
    return stream.getvalue()


def test_the_word_blank_can_be_filled_in_and_uploaded_back():
    """The anti-drift guarantee again, in the second format."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    downloaded = client.get(f"/api/v1/tournaments/{tournament_id}/participants/template.docx")
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.headers["content-type"].startswith(DOCX)

    document = Document(BytesIO(downloaded.content))
    entries, disciplines = document.tables[0], document.tables[1]
    assert [cell.text for cell in entries.rows[0].cells] == [
        column.header_ru for column in IMPORT_COLUMNS
    ]
    # The second table replaces the spreadsheet's second sheet: a Word document
    # has no sheets, and «Категория» is unfillable without the discipline names.
    assert "Абсолютная ветеранская" in [row.cells[0].text for row in disciplines.rows]

    filled = entries.add_row().cells
    values = {
        "full_name": "Замятин Пётр",
        "fight_name": "Кистень",
        "city": "Новгород",
        "club": "Буза",
        "category": "Абсолютная ветеранская",
        "birth_year": str(EVENT_YEAR - 50),
    }
    for cell, column in zip(filled, IMPORT_COLUMNS):
        cell.text = values.get(column.key, "")
    stream = BytesIO()
    document.save(stream)

    report = preview_files(client, tournament_id, [("заявка.docx", stream.getvalue())], headers)
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["total_rows"] == 1, body["rows"]
    assert body["valid_rows"] == 1
    assert body["rows"][0]["competition_name"] == "Абсолютная ветеранская"


def test_word_and_excel_files_are_reviewed_together():
    """One club sends a document, another a spreadsheet, and it is one заявка."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    report = preview_files(
        client,
        tournament_id,
        [
            ("буза.docx", doc_of([{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}])),
            (
                "сокол.xlsx",
                sheet_of([{"full_name": "Пётр Петров", "category": "Абсолютная мужская"}]),
            ),
        ],
        headers,
    ).json()

    assert report["total_rows"] == 2
    assert report["valid_rows"] == 2
    assert [row["source_file"] for row in report["rows"]] == ["буза.docx", "сокол.xlsx"]


def test_a_fighter_sent_in_word_and_in_excel_is_still_a_duplicate():
    """The format a club chose must not be a way in for the same fighter twice."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)
    entry = [{"full_name": "Иван Иванов", "category": "Абсолютная мужская"}]

    report = preview_files(
        client,
        tournament_id,
        [("буза.docx", doc_of(entry)), ("сокол.xlsx", sheet_of(entry))],
        headers,
    ).json()

    assert codes(report, 0) == set()
    assert "DUPLICATE_IN_FILE" in codes(report, 1)


def test_the_word_blank_examples_are_dropped_and_counted():
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    downloaded = client.get(f"/api/v1/tournaments/{tournament_id}/participants/template.docx")
    report = preview_files(
        client, tournament_id, [("бланк.docx", downloaded.content)], headers
    ).json()

    assert report["total_rows"] == 0
    assert report["files"][0]["skipped_examples"] == 2


def test_an_old_doc_file_is_refused_with_the_format_named():
    """A .doc is a different format entirely, and «не прочитался» would not help."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    refused = preview_files(
        client,
        tournament_id,
        # Not a zip archive, unlike .docx — which is exactly what the old binary
        # format is, and why only the extension can answer this one.
        [("заявка.doc", b"old binary word document")],
        headers,
    )
    assert refused.status_code == 400, refused.text
    assert "docx" in refused.json()["detail"].lower()


def test_a_document_without_the_entry_table_is_refused_clearly():
    """Guessing at a free-form list would enter people nobody checked."""
    client = setup_app_for_tests()
    tournament_id, headers = bootstrap(client)

    document = Document()
    document.add_paragraph("Заявка клуба «Буза»: Иванов Иван, Петров Пётр")
    stream = BytesIO()
    document.save(stream)

    refused = preview_files(client, tournament_id, [("вольная.docx", stream.getvalue())], headers)
    assert refused.status_code == 400, refused.text
    assert "бланк" in refused.json()["detail"].lower()


# ------------------------------------------------------------------- guards


def test_anyone_may_download_the_blank_form():
    """A club's coach fills this in, and a coach is not the organizer.

    Nothing in it is private: the second sheet holds the discipline names and
    age bounds that ``GET /tournaments/{id}/competitions`` already serves to
    anyone.
    """
    client = setup_app_for_tests()
    tournament_id, _ = bootstrap(client)

    anonymous = client.get(f"/api/v1/tournaments/{tournament_id}/participants/template.xlsx")
    assert anonymous.status_code == 200, anonymous.text
    assert anonymous.headers["content-type"].startswith(XLSX)

    workbook = load_workbook(BytesIO(anonymous.content))
    assert SHEET_ENTRIES in workbook.sheetnames
    reference = workbook["Дисциплины"]
    names = [row[0] for row in reference.iter_rows(min_row=2, values_only=True)]
    assert "Абсолютная ветеранская" in names


def test_a_missing_tournament_still_has_no_blank_form():
    client = setup_app_for_tests()
    bootstrap(client)
    missing = client.get(
        "/api/v1/tournaments/00000000-0000-0000-0000-000000000001/participants/template.xlsx"
    )
    assert missing.status_code == 404, missing.text


def test_entering_people_still_requires_an_authorized_manager():
    """Reading the form is open; putting anyone in the roster is not."""
    client = setup_app_for_tests()
    tournament_id, _ = bootstrap(client)
    payload = sheet_of([{"full_name": "Чужой", "category": "Абсолютная мужская"}])

    client.cookies.clear()
    anonymous = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/preview",
        files={"file": ("entries.xlsx", payload, XLSX)},
    )
    assert anonymous.status_code == 401, anonymous.text

    _, stranger = register(client, "stranger@example.com")
    assert preview(client, tournament_id, payload, stranger).status_code == 403

    committed = client.post(
        f"/api/v1/tournaments/{tournament_id}/participants/import/commit",
        json={"rows": []},
    )
    assert committed.status_code == 403, committed.text
