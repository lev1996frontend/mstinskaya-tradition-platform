"""Who may enter a discipline.

A category like «Ветераны» is 45+, «Абсолютная детская» has an upper bound, and
the general adult absolute has neither — a fifty-year-old may enter both the
veterans' category and the open one, so the bounds are per-discipline and each
is independently optional.

Age is counted in whole years reached during the calendar year of the event,
not exact age on the day. That is the meaning confirmed for these categories,
and it is also the only precision available: :class:`Athlete` stores
``birth_year``, not a birth date, and asking organizers for a full date to
support a rule nobody asked for would be inventing a requirement.

Pure, like :mod:`app.modules.tournaments.domain.bracket` — no session, no
HTTP, so it can be unit-tested directly and called from both the entry
endpoint and the spreadsheet importer without either one owning the rule.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

#: Codes a caller can branch on. The messages are Russian because they are
#: shown verbatim in the import report, next to the row that failed.
AGE_BELOW_MINIMUM = "AGE_BELOW_MINIMUM"
AGE_ABOVE_MAXIMUM = "AGE_ABOVE_MAXIMUM"
MISSING_BIRTH_YEAR = "MISSING_BIRTH_YEAR"


@dataclass(frozen=True)
class AgeVerdict:
    ok: bool
    code: str | None = None
    message: str | None = None
    age: int | None = None


def age_in_year(birth_year: int, event_year: int) -> int:
    """Whole years the fighter turns during ``event_year``."""
    return event_year - birth_year


def check_age(
    birth_year: int | None,
    *,
    min_age: int | None,
    max_age: int | None,
    event_year: int,
) -> AgeVerdict:
    """Whether this fighter fits a discipline's age bounds.

    An unbounded discipline never asks for a birth year — demanding data the
    rule does not use would block entries for no reason. A bounded one does,
    and says so rather than quietly letting an unverifiable entry through.
    """
    if min_age is None and max_age is None:
        return AgeVerdict(ok=True, age=None if birth_year is None else age_in_year(birth_year, event_year))

    if birth_year is None:
        return AgeVerdict(
            ok=False,
            code=MISSING_BIRTH_YEAR,
            message="У дисциплины есть возрастное ограничение — укажите год рождения",
        )

    age = age_in_year(birth_year, event_year)
    if min_age is not None and age < min_age:
        return AgeVerdict(
            ok=False,
            code=AGE_BELOW_MINIMUM,
            message=f"В год турнира исполняется {age}, а нужно не меньше {min_age}",
            age=age,
        )
    if max_age is not None and age > max_age:
        return AgeVerdict(
            ok=False,
            code=AGE_ABOVE_MAXIMUM,
            message=f"В год турнира исполняется {age}, а нужно не больше {max_age}",
            age=age,
        )
    return AgeVerdict(ok=True, age=age)


def describe_bounds(min_age: int | None, max_age: int | None) -> str | None:
    """Short Russian label for a discipline's bounds, or ``None`` if unbounded."""
    if min_age is not None and max_age is not None:
        # An age stream can be one year wide, and «14–14 лет» reads as a typo.
        if min_age == max_age:
            return f"{min_age} лет"
        return f"{min_age}–{max_age} лет"
    if min_age is not None:
        return f"{min_age}+"
    if max_age is not None:
        return f"до {max_age} лет"
    return None


# ---------------------------------------------------------------- age bands


@dataclass(frozen=True)
class AgeBand:
    """One age stream of a discipline that is too wide to fight as a whole."""

    min_age: int
    max_age: int
    participant_ids: tuple[str, ...]

    @property
    def label(self) -> str:
        """«8–9» for a spread, «11» when everyone in the band is the same age."""
        return str(self.min_age) if self.min_age == self.max_age else f"{self.min_age}–{self.max_age}"

    @property
    def is_lonely(self) -> bool:
        """A band nobody can be matched against — a champion with no bout.

        Reported rather than fixed. Folding this fighter into the neighbouring
        band is exactly what ``max_gap`` exists to prevent, so the choice —
        run it as it is, widen the gap, or leave the discipline undivided —
        belongs to the organizer.
        """
        return len(self.participant_ids) < 2


def split_into_age_bands(
    entrants: Sequence[tuple[str, int]],
    *,
    max_gap: int,
) -> list[AgeBand]:
    """Cut a field into the fewest streams whose inner age spread is ``max_gap``.

    ``entrants`` is ``(participant_id, age)``; ages are whole years reached in
    the year of the event, the same measure :func:`check_age` uses.

    Greedy from the youngest: open a band on the youngest unplaced fighter and
    take everyone within ``max_gap`` of them. That is not a heuristic — for
    covering points on a line with fixed-width intervals it is provably
    minimal, so there is no rule being invented about who ends up with whom.

    ``max_gap`` is the *difference* between the youngest and the oldest in a
    band, so a gap of 2 puts 8, 9 and 10 together and starts a new band at 11.
    """
    if max_gap < 0:
        raise ValueError("Возрастной разрыв не может быть отрицательным")

    ordered = sorted(entrants, key=lambda pair: (pair[1], pair[0]))
    bands: list[AgeBand] = []
    index = 0
    while index < len(ordered):
        youngest = ordered[index][1]
        members: list[tuple[str, int]] = []
        while index < len(ordered) and ordered[index][1] - youngest <= max_gap:
            members.append(ordered[index])
            index += 1
        bands.append(
            AgeBand(
                min_age=members[0][1],
                max_age=members[-1][1],
                participant_ids=tuple(participant_id for participant_id, _ in members),
            )
        )
    return bands
