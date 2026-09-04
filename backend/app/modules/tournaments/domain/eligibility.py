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
        return f"{min_age}–{max_age} лет"
    if min_age is not None:
        return f"{min_age}+"
    if max_age is not None:
        return f"до {max_age} лет"
    return None
