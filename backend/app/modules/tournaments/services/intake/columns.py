"""What an entry list is made of, independent of the file it arrived in.

The columns, the limits, the example rows and the two text helpers live here
because two formats now read and write the same list: a spreadsheet
(:mod:`..intake.excel`) and a Word document (:mod:`..intake.word`). Both walk
:data:`IMPORT_COLUMNS` to build their blank and to read a filled-in one, so the
file the organizer is handed and the file the server expects cannot drift apart
— in either format. The round-trip tests prove it once per format.

Nothing here touches the database, FastAPI or a document library. It is the
shape of the paperwork, and only that.
"""

from __future__ import annotations

from dataclasses import dataclass

#: A hand-filled entry list larger than this is a mistake, not a заявка, and
#: parsing it would tie up a worker for no good reason.
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_DATA_ROWS = 2000

#: Entry lists arrive one file per club, so a handful at once is normal and a
#: hundred is a mistake. Both bounds are on the request as a whole: the per-file
#: limit above already stops any single file from being outsized.
MAX_UPLOAD_FILES = 10
MAX_TOTAL_UPLOAD_BYTES = 8 * 1024 * 1024


@dataclass(frozen=True)
class ImportColumn:
    key: str
    header_ru: str
    required: bool
    note: str
    width: int


#: The one place the file format is described. Order here is the order in the
#: blank; the parsers match on ``header_ru`` and only fall back to this order
#: when they recognize no header at all.
IMPORT_COLUMNS: tuple[ImportColumn, ...] = (
    ImportColumn("full_name", "ФИО", True, "обязательно", 32),
    ImportColumn(
        "fight_name",
        "Драковое имя",
        False,
        "если есть; пусто — в сетке будет ФИО",
        22,
    ),
    ImportColumn("city", "Город", False, "разводит земляков в первом круге", 20),
    ImportColumn("club", "Клуб", False, "разводит одноклубников, важнее города", 24),
    ImportColumn(
        "category",
        "Категория",
        True,
        "название дисциплины из листа «Дисциплины»",
        28,
    ),
    ImportColumn(
        "birth_year",
        "Год рождения",
        False,
        "обязателен только там, где у дисциплины есть возрастное ограничение",
        14,
    ),
    ImportColumn("seed", "Посев", False, "необязательно", 10),
    ImportColumn(
        "reserve",
        "Запасной",
        False,
        "«да» — в сетку не попадёт, ждёт замены",
        12,
    ),
)

COLUMN_BY_KEY = {column.key: column for column in IMPORT_COLUMNS}

#: What counts as "yes" in «Запасной». Anything outside these two sets is a row
#: error rather than a silent "no": a typo in this column decides whether a
#: fighter is in the draw at all.
RESERVE_YES = frozenset({"да", "yes", "y", "д", "1", "+", "true", "истина"})
RESERVE_NO = frozenset({"", "нет", "no", "n", "н", "0", "-", "false", "ложь"})

#: Prefix marking a row the blank filled in for illustration. The parsers drop
#: these, so a file uploaded without deleting them enters nobody. A marker
#: rather than a row number, because an organizer who inserts a row above would
#: otherwise shift the examples into their own entry list.
EXAMPLE_MARKER = "ПРИМЕР:"

#: Shown filled in so the format is read off a real row rather than guessed at
#: from the notes. Deliberately exercising the awkward parts: a fighter with no
#: драковое имя, and one held in reserve.
EXAMPLE_ROWS: tuple[dict[str, str], ...] = (
    {
        "full_name": f"{EXAMPLE_MARKER} Замятин Пётр Ильич",
        "fight_name": "Кистень",
        "city": "Великий Новгород",
        "club": "Буза",
        "category": "название из листа «Дисциплины»",
        "birth_year": "1998",
        "seed": "1",
        "reserve": "нет",
    },
    {
        "full_name": f"{EXAMPLE_MARKER} Сергеев Сергей Сергеевич",
        "fight_name": "",
        "city": "Псков",
        "club": "Сокол",
        "category": "название из листа «Дисциплины»",
        "birth_year": "2005",
        "seed": "",
        "reserve": "да",
    },
)

#: Notes are written under the headers in both blanks, so both parsers have to
#: recognize and skip that row.
COLUMN_NOTES = frozenset(column.note for column in IMPORT_COLUMNS)


def normalize(value: str | None) -> str:
    """Comparison key for a header, a name or a category — same rule everywhere."""
    if not value:
        return ""
    return " ".join(str(value).split()).casefold()


def text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


@dataclass
class RawRow:
    """One data row, still text, before anything is checked."""

    row_number: int
    values: dict[str, str]


@dataclass
class ParsedSheet:
    """One file's worth of rows, plus what was dropped getting them.

    The count of dropped examples is carried out rather than discarded because
    dropping them silently was a real trap: an organizer who typed their own
    fighter over an example row without deleting the «ПРИМЕР:» marker got no
    row and no explanation.
    """

    rows: list[RawRow]
    skipped_examples: int = 0


def row_from(values: dict[str, str], row_number: int) -> RawRow:
    return RawRow(row_number=row_number, values=values)


def is_example(values: dict[str, str]) -> bool:
    return values["full_name"].startswith(EXAMPLE_MARKER)


def is_noise(values: dict[str, str]) -> bool:
    """A blank spacer row, or the blank's own row of italic notes."""
    return not any(values.values()) or values["full_name"] in COLUMN_NOTES
