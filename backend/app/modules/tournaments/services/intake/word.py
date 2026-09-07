"""The entry list as a Word document: writing the blank, reading it back.

The same eight columns as the spreadsheet, in a table. A club that works in
Word gets a blank it can fill in without converting anything, and the rows it
yields are indistinguishable from a spreadsheet's by the time they reach
validation.

Only a table is read. A free-form list — «Заявка клуба: Иванов, Петров» — is
refused rather than guessed at: a guess here does not produce a bad row that
someone notices, it produces a person entered into a tournament under a name
nobody checked.
"""

from __future__ import annotations

from io import BytesIO
from typing import BinaryIO, Sequence

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt
from fastapi import HTTPException

from app.modules.tournaments.domain import eligibility
from app.modules.tournaments.models import Competition, Tournament

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

TABLE_DISCIPLINES = "Дисциплины"


def _write_row(cells, values: dict[str, str], *, italic: bool = False, bold: bool = False) -> None:
    for cell, column in zip(cells, IMPORT_COLUMNS):
        cell.text = values.get(column.key, "")
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.italic = italic
                run.bold = bold
                run.font.size = Pt(9) if italic else Pt(10)


def build_template_document(
    tournament: Tournament, competitions: Sequence[Competition]
) -> BytesIO:
    """The .docx the organizer fills in.

    Carries the disciplines as a second table rather than a second sheet — a
    document has no sheets, and «Категория» cannot be filled in correctly
    without the names the parser will accept.
    """
    document = Document()

    title = document.add_paragraph(tournament.title)
    title.runs[0].bold = True
    title.runs[0].font.size = Pt(14)
    if tournament.start_date is not None:
        stamp = document.add_paragraph(f"Заявка на {tournament.start_date.isoformat()}")
        stamp.runs[0].font.size = Pt(9)
        stamp.alignment = WD_ALIGN_PARAGRAPH.LEFT

    document.add_paragraph(
        "Впишите бойцов в таблицу ниже, по строке на человека. Серые строки-примеры "
        "можно оставить как есть — они не попадут в заявку."
    ).runs[0].font.size = Pt(9)

    entries = document.add_table(rows=1, cols=len(IMPORT_COLUMNS))
    entries.style = "Table Grid"
    _write_row(
        entries.rows[0].cells,
        {column.key: column.header_ru for column in IMPORT_COLUMNS},
        bold=True,
    )
    _write_row(
        entries.add_row().cells,
        {column.key: column.note for column in IMPORT_COLUMNS},
        italic=True,
    )
    for example in EXAMPLE_ROWS:
        _write_row(entries.add_row().cells, example, italic=True)
    # Two empty rows so the blank looks like something to write in rather than
    # something to study. More would only be rows to delete.
    for _ in range(2):
        entries.add_row()

    document.add_paragraph()
    heading = document.add_paragraph(TABLE_DISCIPLINES)
    heading.runs[0].bold = True

    reference = document.add_table(rows=1, cols=3)
    reference.style = "Table Grid"
    for cell, value in zip(reference.rows[0].cells, ("Дисциплина", "Возраст", "Тип")):
        cell.text = value
        cell.paragraphs[0].runs[0].bold = True
    for competition in competitions:
        cells = reference.add_row().cells
        cells[0].text = competition.name
        cells[1].text = (
            eligibility.describe_bounds(competition.min_age, competition.max_age)
            or "без ограничения"
        )
        cells[2].text = "команды" if competition.competition_type == "TEAM" else "лично"

    stream = BytesIO()
    document.save(stream)
    stream.seek(0)
    return stream


def parse_document(stream: BinaryIO) -> ParsedSheet:
    """Read the entry table out of an uploaded document.

    The first table whose header row names any of the blank's columns is the
    entry list; the disciplines table below it names none of them and is
    therefore skipped on the same rule. Columns are matched by header text, so a
    reordered table still imports.
    """
    try:
        document = Document(stream)
    except Exception:  # noqa: BLE001 — python-docx raises several package errors
        raise HTTPException(
            status_code=400,
            detail="Не удалось прочитать документ. Нужен .docx — старый .doc не поддерживается.",
        ) from None

    header_by_norm = {normalize(column.header_ru): column.key for column in IMPORT_COLUMNS}
    for table in document.tables:
        if not table.rows:
            continue
        mapping: dict[int, str] = {}
        for index, cell in enumerate(table.rows[0].cells):
            key = header_by_norm.get(normalize(text(cell.text)))
            if key is not None:
                mapping[index] = key
        if not mapping:
            continue

        body = table.rows[1:]
        if len(body) > MAX_DATA_ROWS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"В документе больше {MAX_DATA_ROWS} строк — "
                    "это не похоже на заявку одного турнира."
                ),
            )

        parsed: list[RawRow] = []
        skipped_examples = 0
        for offset, row in enumerate(body):
            cells = row.cells
            values = {column.key: "" for column in IMPORT_COLUMNS}
            for index, key in mapping.items():
                if index < len(cells):
                    values[key] = text(cells[index].text)
            if is_noise(values):
                continue
            if is_example(values):
                skipped_examples += 1
                continue
            parsed.append(RawRow(row_number=offset + 2, values=values))
        return ParsedSheet(rows=parsed, skipped_examples=skipped_examples)

    raise HTTPException(
        status_code=400,
        detail=(
            "В документе нет таблицы с заявкой. Скачайте бланк в формате Word и заполните "
            "его таблицу — свободный список система не читает."
        ),
    )
