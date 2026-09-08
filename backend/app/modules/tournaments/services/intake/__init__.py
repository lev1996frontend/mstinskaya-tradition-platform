"""Entry-list files: one blank per format, one set of rows out.

Two formats fill in the same заявка — a spreadsheet (:mod:`.excel`) and a Word
document (:mod:`.word`) — and both are built from and read back against the one
column definition in :mod:`.columns`. Above this package nothing knows which
format a fighter arrived in: the caller gets :class:`~.columns.ParsedSheet`
either way, and validation judges rows.

:func:`parse_entry_file` is the only entry point a caller needs.
"""

from __future__ import annotations

from io import BytesIO
from typing import BinaryIO

from fastapi import HTTPException

from app.core.file_format import sniff
from .columns import (
    COLUMN_BY_KEY,
    EXAMPLE_MARKER,
    EXAMPLE_ROWS,
    IMPORT_COLUMNS,
    MAX_DATA_ROWS,
    MAX_TOTAL_UPLOAD_BYTES,
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_FILES,
    RESERVE_NO,
    RESERVE_YES,
    ImportColumn,
    ParsedSheet,
    RawRow,
    normalize,
    text,
)
from .excel import SHEET_DISCIPLINES, SHEET_ENTRIES, build_template_workbook, parse_workbook
from .word import build_template_document, parse_document

__all__ = [
    "COLUMN_BY_KEY",
    "EXAMPLE_MARKER",
    "EXAMPLE_ROWS",
    "IMPORT_COLUMNS",
    "MAX_DATA_ROWS",
    "MAX_TOTAL_UPLOAD_BYTES",
    "MAX_UPLOAD_BYTES",
    "MAX_UPLOAD_FILES",
    "RESERVE_NO",
    "RESERVE_YES",
    "SHEET_DISCIPLINES",
    "SHEET_ENTRIES",
    "ImportColumn",
    "ParsedSheet",
    "RawRow",
    "build_template_document",
    "build_template_workbook",
    "normalize",
    "parse_document",
    "parse_entry_file",
    "parse_workbook",
    "text",
]

#: Extensions worth naming in the refusal when the file is not a readable
#: archive at all. A user who sent the old binary format needs to be told to
#: re-save, not that "the file could not be read".
LEGACY_WORD = (".doc", ".rtf", ".odt")


def parse_entry_file(filename: str, payload: bytes) -> ParsedSheet:
    """Read one uploaded entry list, whatever format it came in.

    The format is decided by what is inside the file rather than by its
    extension: both formats are zip archives, and an organizer renaming a
    document to ``.xlsx`` — or a mail client mangling the name — must not decide
    which parser runs. The extension is consulted only when the file is not a
    readable archive, and then only to make the refusal specific.
    """
    stream: BinaryIO = BytesIO(payload)
    kind = sniff(payload)
    if kind == "docx":
        return parse_document(stream)
    if kind == "xlsx":
        return parse_workbook(stream)

    lowered = filename.lower()
    if lowered.endswith(LEGACY_WORD):
        raise HTTPException(
            status_code=400,
            detail=(
                "Не удалось прочитать документ. Нужен .docx — старый .doc не поддерживается, "
                "пересохраните файл в Word как «Документ Word (.docx)»."
            ),
        )
    # Anything else falls to the spreadsheet reader, whose refusal names .xlsx
    # and .xls — the likeliest mistake for a file that is neither archive.
    return parse_workbook(stream)
