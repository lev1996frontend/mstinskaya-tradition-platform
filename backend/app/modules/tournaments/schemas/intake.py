"""Wire shapes for the spreadsheet entry list."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ImportColumnSpec(BaseModel):
    """One column of the template, described for the UI legend."""

    key: str
    header_ru: str
    required: bool
    note: str


class ImportCompetitionSpec(BaseModel):
    """A discipline the «Категория» column may name."""

    id: str
    name: str
    age_label: str | None = None


class ImportRowError(BaseModel):
    code: str
    column: str
    message: str


class ImportRow(BaseModel):
    """One row after checking, with everything wrong about it listed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    row_number: int
    full_name: str = ""
    fight_name: str | None = None
    city: str | None = None
    club: str | None = None
    category: str | None = None
    birth_year: int | None = None
    seed: int | None = None
    #: Held back from the draw, waiting to take a withdrawn fighter's place.
    reserve: bool = False
    #: Resolved from ``category``; null when it matched no discipline.
    competition_id: str | None = None
    competition_name: str | None = None
    #: Set when an existing platform profile matched, so the import links to it
    #: instead of minting a second identity for the same person.
    athlete_id: str | None = None
    athlete_display_name: str | None = None
    #: Драковое имя when there is one, otherwise ФИО.
    display_name: str = ""
    errors: list[ImportRowError] = Field(default_factory=list)
    valid: bool = False


class ImportReport(BaseModel):
    tournament_id: str
    columns: list[ImportColumnSpec] = Field(default_factory=list)
    competitions: list[ImportCompetitionSpec] = Field(default_factory=list)
    total_rows: int = 0
    valid_rows: int = 0
    rows: list[ImportRow] = Field(default_factory=list)
    #: Category names in the file matching no discipline — listed once so the
    #: organizer sees the mismatch as one problem, not per row.
    unknown_categories: list[str] = Field(default_factory=list)


class ImportRowInput(BaseModel):
    """A row submitted for commit.

    Deliberately the *rows*, not the file again: the organizer may have fixed a
    discipline or a birth year in the review table, and re-parsing would throw
    those edits away. Which is exactly why the server re-runs the same validator
    over whatever arrives here — this is client-supplied data.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    row_number: int = 0
    full_name: str = ""
    fight_name: str | None = None
    city: str | None = None
    club: str | None = None
    category: str | None = None
    birth_year: int | None = None
    seed: int | None = None
    reserve: bool = False


class ImportCommitRequest(BaseModel):
    rows: list[ImportRowInput] = Field(default_factory=list, max_length=2000)


class ImportCommitResponse(BaseModel):
    tournament_id: str
    created: int
    #: How many entries landed in each discipline, so the UI can say where
    #: everyone went without re-fetching.
    per_competition: dict[str, int] = Field(default_factory=dict)
