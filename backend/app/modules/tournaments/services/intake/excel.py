"""The entry list as a spreadsheet: writing the blank, reading it back.

Everything here is openpyxl and nothing else — no database, no FastAPI beyond
the one exception raised for a file that cannot be read. What a column *means*
lives in :mod:`.columns`, which this module walks to build the blank and to
recognize a filled-in one.
"""

from __future__ import annotations

from io import BytesIO
from typing import BinaryIO, Sequence

from fastapi import HTTPException
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from app.modules.tournaments.domain import eligibility
from app.modules.tournaments.models import Competition

from .columns import (
    EXAMPLE_ROWS,
    IMPORT_COLUMNS,
    MAX_DATA_ROWS,
    ParsedSheet,
    RawRow,
    is_example,
    is_noise,
    normalize,
    text,
)

SHEET_ENTRIES = "Участники"
SHEET_DISCIPLINES = "Дисциплины"


def build_template_workbook(competitions: Sequence[Competition]) -> BytesIO:
    """The .xlsx the organizer fills in.

    Carries a second, read-only sheet listing the tournament's disciplines with
    their age bounds, so «Категория» can be filled in correctly without
    guessing at a name the parser will then reject.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_ENTRIES

    for index, column in enumerate(IMPORT_COLUMNS, start=1):
        letter = get_column_letter(index)
        header = sheet.cell(row=1, column=index, value=column.header_ru)
        header.font = Font(bold=True)
        note = sheet.cell(row=2, column=index, value=column.note)
        note.font = Font(italic=True, size=9)
        note.alignment = Alignment(wrap_text=True, vertical="top")
        sheet.column_dimensions[letter].width = column.width

    example_font = Font(italic=True, color="FF808080")
    for example in EXAMPLE_ROWS:
        sheet.append([example.get(column.key, "") for column in IMPORT_COLUMNS])
        for cell in sheet[sheet.max_row]:
            cell.font = example_font

    # Headers, notes and the examples all stay visible while the organizer
    # scrolls their own rows.
    sheet.freeze_panes = f"A{2 + len(EXAMPLE_ROWS) + 1}"

    reference = workbook.create_sheet(SHEET_DISCIPLINES)
    reference.append(["Дисциплина", "Возраст", "Тип"])
    reference["A1"].font = Font(bold=True)
    reference["B1"].font = Font(bold=True)
    reference["C1"].font = Font(bold=True)
    for competition in competitions:
        reference.append(
            [
                competition.name,
                eligibility.describe_bounds(competition.min_age, competition.max_age)
                or "без ограничения",
                "команды" if competition.competition_type == "TEAM" else "лично",
            ]
        )
    reference.column_dimensions["A"].width = 32
    reference.column_dimensions["B"].width = 18
    reference.column_dimensions["C"].width = 12

    stream = BytesIO()
    workbook.save(stream)
    stream.seek(0)
    return stream


def parse_workbook(stream: BinaryIO) -> ParsedSheet:
    """Read the uploaded sheet into raw text rows.

    Columns are located by header text, so a sheet whose columns were reordered
    still imports. Only when no header is recognized does it fall back to
    :data:`IMPORT_COLUMNS` order, and a file matching neither is refused rather
    than silently read as gibberish.
    """
    try:
        workbook = load_workbook(stream, read_only=True, data_only=True)
    except Exception:  # noqa: BLE001 — openpyxl raises a zoo of format errors
        raise HTTPException(
            status_code=400,
            detail="Не удалось прочитать файл. Нужен .xlsx — старый .xls не поддерживается.",
        ) from None

    sheet = (
        workbook[SHEET_ENTRIES] if SHEET_ENTRIES in workbook.sheetnames else workbook.worksheets[0]
    )
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return ParsedSheet(rows=[])

    header_by_norm = {normalize(column.header_ru): column.key for column in IMPORT_COLUMNS}
    mapping: dict[int, str] = {}
    for index, cell in enumerate(rows[0]):
        key = header_by_norm.get(normalize(text(cell)))
        if key is not None:
            mapping[index] = key

    if mapping:
        body = rows[1:]
    else:
        # No recognizable header. Positional order is the only remaining
        # reading, and it is only worth trying if the first cell holds a name.
        if not text(rows[0][0] if rows[0] else None):
            raise HTTPException(
                status_code=400,
                detail=(
                    "В файле не найдены заголовки колонок. Скачайте бланк и заполните его — "
                    "первая строка должна называть колонки."
                ),
            )
        mapping = {index: column.key for index, column in enumerate(IMPORT_COLUMNS)}
        body = rows

    if len(body) > MAX_DATA_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"В файле больше {MAX_DATA_ROWS} строк — это не похоже на заявку одного турнира.",
        )

    parsed: list[RawRow] = []
    skipped_examples = 0
    for offset, raw in enumerate(body):
        values = {column.key: "" for column in IMPORT_COLUMNS}
        for index, key in mapping.items():
            if index < len(raw):
                values[key] = text(raw[index])
        if is_noise(values):
            continue
        # A row the blank filled in for illustration, left in place by an
        # organizer who did not delete it.
        if is_example(values):
            skipped_examples += 1
            continue
        parsed.append(RawRow(row_number=offset + 2 if mapping else offset + 1, values=values))
    return ParsedSheet(rows=parsed, skipped_examples=skipped_examples)
