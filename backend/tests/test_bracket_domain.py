"""Unit tests for the pure bracket planner.

Every other test in this suite drives the API through a ``TestClient`` over an
in-memory SQLite engine. These do not: ``app.modules.tournaments.domain.bracket``
is deliberately free of SQLAlchemy and FastAPI, and testing it directly is the
only way to pin down properties that an API test can only sample — the exact
slot order, what happens when the city constraint is unsatisfiable, and the
seeding identity the group stage will later depend on.
"""

from __future__ import annotations

import random

import pytest

from app.modules.tournaments.domain import bracket as bracket_domain
from app.modules.tournaments.domain import eligibility


def entrant(
    name: str,
    *,
    city: str | None = None,
    club: str | None = None,
    seed: int | None = None,
) -> bracket_domain.Entrant:
    """An entrant whose participant id is derived from its name, for readable failures."""
    return bracket_domain.Entrant(
        participant_id=f"id-{name.lower()}", display_name=name, city=city, club=club, seed=seed
    )


# --------------------------------------------------------------- slot order


def test_next_power_of_two_never_returns_less_than_the_field():
    assert bracket_domain.next_power_of_two(2) == 2
    assert bracket_domain.next_power_of_two(3) == 4
    assert bracket_domain.next_power_of_two(9) == 16
    assert bracket_domain.next_power_of_two(16) == 16
    assert bracket_domain.next_power_of_two(17) == 32


def test_standard_seed_order_keeps_the_top_two_apart_until_the_final():
    """Ranks 1 and 2 must sit in opposite halves at every bracket size."""
    for size in (2, 4, 8, 16, 32):
        order = bracket_domain.standard_seed_order(size)
        assert sorted(order) == list(range(1, size + 1)), f"size {size} lost or repeated a rank"
        half = size // 2
        assert (order.index(1) < half) != (order.index(2) < half), f"size {size} put 1 and 2 in one half"


def test_standard_seed_order_pairs_best_against_worst():
    assert bracket_domain.standard_seed_order(4) == [1, 4, 2, 3]
    assert bracket_domain.standard_seed_order(8) == [1, 8, 4, 5, 2, 7, 3, 6]


def test_standard_seed_order_rejects_a_non_power_of_two():
    with pytest.raises(ValueError):
        bracket_domain.standard_seed_order(6)


def test_stage_names_are_read_from_the_match_count():
    assert bracket_domain.stage_name_for_round(1) == "FINAL"
    assert bracket_domain.stage_name_for_round(2) == "SEMIFINAL"
    assert bracket_domain.stage_name_for_round(4) == "QUARTERFINAL"
    assert bracket_domain.stage_name_for_round(8) == "ROUND_OF_16"
    assert bracket_domain.stage_name_for_round(16) == "ROUND_OF_32"


# ------------------------------------------------------------------ ranking


def test_seeded_entrants_come_first_and_in_seed_order():
    field = [entrant("Гость"), entrant("Второй", seed=2), entrant("Первый", seed=1)]
    ranked = bracket_domain.rank_entrants(field, rng=random.Random(7))
    assert [e.display_name for e in ranked[:2]] == ["Первый", "Второй"]
    assert ranked[2].display_name == "Гость"


def test_unseeded_entrants_are_shuffled_not_left_in_input_order():
    """A deterministic rng makes the shuffle observable without flaking."""
    field = [entrant(f"Боец{index}") for index in range(12)]
    ranked = bracket_domain.rank_entrants(field, rng=random.Random(1))
    assert {e.display_name for e in ranked} == {e.display_name for e in field}
    assert [e.display_name for e in ranked] != [e.display_name for e in field]


# ------------------------------------------------------------------ planning


def test_a_bracket_needs_two_fighters():
    with pytest.raises(ValueError):
        bracket_domain.build_plan([entrant("Один")])


@pytest.mark.parametrize(
    ("count", "bracket_size", "byes", "rounds"),
    [(2, 2, 0, 1), (3, 4, 1, 2), (5, 8, 3, 3), (8, 8, 0, 3), (10, 16, 6, 4), (16, 16, 0, 4)],
)
def test_plan_sizing(count: int, bracket_size: int, byes: int, rounds: int):
    plan = bracket_domain.build_plan(
        [entrant(f"Боец{index}") for index in range(count)], rng=random.Random(3)
    )
    assert (plan.bracket_size, plan.bye_count, plan.round_count) == (bracket_size, byes, rounds)
    assert len(plan.first_round) == bracket_size // 2
    assert plan.participant_count == count


def test_every_entrant_is_seated_exactly_once():
    field = [entrant(f"Боец{index}") for index in range(10)]
    plan = bracket_domain.build_plan(field, rng=random.Random(5))
    seated = [
        occupant.participant_id
        for pair in plan.first_round
        for occupant in (pair.a, pair.b)
        if occupant is not None
    ]
    assert sorted(seated) == sorted(e.participant_id for e in field)


def test_a_bye_pair_holds_exactly_one_fighter():
    plan = bracket_domain.build_plan(
        [entrant(f"Боец{index}") for index in range(5)], rng=random.Random(11)
    )
    byes = [pair for pair in plan.first_round if pair.is_bye]
    assert len(byes) == plan.bye_count
    for pair in byes:
        assert (pair.a is None) != (pair.b is None)
        assert pair.occupant is not None


def test_no_pair_is_left_completely_empty():
    """A padded bracket must spend its byes, not leave a hole in the round."""
    for count in range(2, 17):
        plan = bracket_domain.build_plan(
            [entrant(f"Боец{index}") for index in range(count)], rng=random.Random(count)
        )
        assert not any(pair.is_empty for pair in plan.first_round), f"{count} fighters left a gap"


# --------------------------------------------------------- city separation


def test_city_keys_ignore_case_and_stray_whitespace():
    assert entrant("А", city="Великий  Новгород").city_key == entrant("Б", city="великий новгород").city_key
    assert entrant("В").city_key is None


def test_fighters_from_one_city_are_separated_when_there_is_room():
    field = [
        entrant("Иван", city="Новгород"),
        entrant("Сергей", city="Новгород"),
        entrant("Пётр", city="Псков"),
        entrant("Фёдор", city="Тверь"),
    ]
    plan = bracket_domain.build_plan(field, rng=random.Random(2))
    assert plan.city_constraint_satisfied
    assert plan.unavoidable_collisions == []
    for pair in plan.first_round:
        if pair.a and pair.b:
            assert pair.a.city_key != pair.b.city_key


def test_an_impossible_distribution_reports_what_it_could_not_separate():
    """Four fighters, one city: the constraint cannot hold and must say so."""
    field = [entrant(name, city="Новгород") for name in ("Иван", "Сергей", "Пётр", "Фёдор")]
    plan = bracket_domain.build_plan(field, rng=random.Random(4))
    assert not plan.city_constraint_satisfied
    assert len(plan.unavoidable_collisions) == 2
    assert {c.city for c in plan.unavoidable_collisions} == {"Новгород"}
    # Reported or not, the bracket is still complete.
    assert len(plan.first_round) == 2


def test_the_resolver_never_trades_a_bye_away():
    """Swapping a lone fighter for a real pair would create an empty slot."""
    field = [
        entrant("Иван", city="Новгород"),
        entrant("Сергей", city="Новгород"),
        entrant("Пётр", city="Псков"),
    ]
    plan = bracket_domain.build_plan(field, rng=random.Random(6))
    assert plan.bye_count == 1
    assert sum(1 for pair in plan.first_round if pair.is_bye) == 1
    assert not any(pair.is_empty for pair in plan.first_round)


def test_resolution_terminates_on_a_hostile_distribution():
    """Half the field from one city is the worst realistic case; it must return."""
    field = [entrant(f"Нов{index}", city="Новгород") for index in range(8)]
    field += [entrant(f"Пск{index}", city="Псков") for index in range(8)]
    plan = bracket_domain.build_plan(field, rng=random.Random(9))
    assert plan.bracket_size == 16
    assert len(plan.first_round) == 8
    assert not any(pair.is_empty for pair in plan.first_round)


# ---------------------------------------------------------- club separation


def test_club_keys_normalize_like_city_keys():
    assert entrant("А", club="Буза  Новгород").club_key == entrant("Б", club="буза новгород").club_key
    assert entrant("В").club_key is None


def test_clubmates_are_separated_too():
    field = [
        entrant("Иван", city="Новгород", club="Буза"),
        entrant("Сергей", city="Псков", club="Буза"),
        entrant("Пётр", city="Тверь", club="Сокол"),
        entrant("Фёдор", city="Москва", club="Ратник"),
    ]
    plan = bracket_domain.build_plan(field, rng=random.Random(2))
    assert plan.separation_satisfied
    for pair in plan.first_round:
        if pair.a and pair.b:
            assert pair.a.club_key != pair.b.club_key


def test_a_club_clash_is_reported_as_a_club_not_a_city():
    """Two fighters, one club, different cities: nothing to swap with."""
    field = [entrant("Иван", city="Новгород", club="Буза"), entrant("Сергей", city="Псков", club="Буза")]
    plan = bracket_domain.build_plan(field, rng=random.Random(4))
    assert not plan.separation_satisfied
    collision = plan.unavoidable_collisions[0]
    assert collision.kind == "CLUB"
    assert collision.value == "Буза"
    assert collision.club == "Буза"
    # A club clash must not masquerade as a city one — they are different news.
    assert collision.city is None
    assert plan.city_constraint_satisfied


def test_club_outranks_city_when_a_pair_shares_both():
    field = [
        entrant("Иван", city="Новгород", club="Буза"),
        entrant("Сергей", city="Новгород", club="Буза"),
    ]
    plan = bracket_domain.build_plan(field, rng=random.Random(5))
    assert [c.kind for c in plan.unavoidable_collisions] == ["CLUB"]


def test_separating_a_club_never_creates_a_city_clash():
    """A swap is only taken when it clears every key on both pairs."""
    field = [
        entrant("Иван", city="Новгород", club="Буза"),
        entrant("Сергей", city="Тверь", club="Буза"),
        entrant("Пётр", city="Новгород", club="Сокол"),
        entrant("Фёдор", city="Тверь", club="Ратник"),
    ]
    plan = bracket_domain.build_plan(field, rng=random.Random(8))
    assert plan.separation_satisfied, [
        (c.kind, c.value) for c in plan.unavoidable_collisions
    ]


# ------------------------------------------------- reporting without fixing


def test_separate_false_reports_but_does_not_reorder():
    """What the group-stage playoff needs: keep the seeding, name the clash.

    Swapping fighters there would destroy the cross-seeding that puts group
    winners in opposite halves, so the collision is reported instead.
    """
    field = [
        entrant("Иван", city="Новгород", seed=1),
        entrant("Сергей", city="Новгород", seed=2),
        entrant("Пётр", city="Псков", seed=3),
        entrant("Фёдор", city="Тверь", seed=4),
    ]
    fixed = bracket_domain.build_plan(field, separate=True)
    reported = bracket_domain.build_plan(field, separate=False)

    # Seeds 1 and 4 meet, 2 and 3 meet — untouched by the reporting run.
    slots = [
        [pair.a.display_name if pair.a else None, pair.b.display_name if pair.b else None]
        for pair in reported.first_round
    ]
    assert slots == [["Иван", "Фёдор"], ["Сергей", "Пётр"]]
    # Nothing collides in this arrangement either way; the point is the order.
    assert reported.unavoidable_collisions == []
    assert fixed.bracket_size == reported.bracket_size


def test_separate_false_still_names_what_collides():
    field = [
        entrant("Иван", city="Новгород", seed=1),
        entrant("Фёдор", city="Новгород", seed=2),
    ]
    plan = bracket_domain.build_plan(field, separate=False)
    assert [c.kind for c in plan.unavoidable_collisions] == ["CITY"]
    assert plan.unavoidable_collisions[0].value == "Новгород"


# ----------------------------------------------------------- age eligibility


def test_an_unbounded_category_accepts_anyone_even_with_no_year():
    verdict = eligibility.check_age(None, min_age=None, max_age=None, event_year=2026)
    assert verdict.ok
    assert verdict.code is None


def test_age_is_the_year_reached_during_the_event_year():
    assert eligibility.age_in_year(1981, 2026) == 45


def test_a_bound_makes_the_birth_year_required():
    verdict = eligibility.check_age(None, min_age=45, max_age=None, event_year=2026)
    assert not verdict.ok
    assert verdict.code == eligibility.MISSING_BIRTH_YEAR


def test_the_minimum_is_inclusive():
    assert eligibility.check_age(1981, min_age=45, max_age=None, event_year=2026).ok
    below = eligibility.check_age(1982, min_age=45, max_age=None, event_year=2026)
    assert not below.ok
    assert below.code == eligibility.AGE_BELOW_MINIMUM
    assert below.age == 44


def test_the_maximum_is_inclusive():
    assert eligibility.check_age(2012, min_age=None, max_age=14, event_year=2026).ok
    above = eligibility.check_age(2011, min_age=None, max_age=14, event_year=2026)
    assert not above.ok
    assert above.code == eligibility.AGE_ABOVE_MAXIMUM


def test_bounds_get_a_short_russian_label():
    assert eligibility.describe_bounds(45, None) == "45+"
    assert eligibility.describe_bounds(None, 14) == "до 14 лет"
    assert eligibility.describe_bounds(12, 14) == "12–14 лет"
    # A one-year-wide stream: «14–14 лет» would read as a typo.
    assert eligibility.describe_bounds(14, 14) == "14 лет"
    assert eligibility.describe_bounds(None, None) is None


# ------------------------------------------------------------- age bands


def band(entrants, gap):
    """`[(id, age)]` → list of `(label, [ids])`, for readable assertions."""
    return [
        (item.label, list(item.participant_ids))
        for item in eligibility.split_into_age_bands(entrants, max_gap=gap)
    ]


CHILDREN = [("ваня", 8), ("гриша", 9), ("тимофей", 11), ("захар", 12), ("митя", 13), ("лёшка", 14)]


def test_a_gap_of_two_cuts_the_children_into_three_streams():
    """8, 9, 11, 12, 13, 14 with a gap of two.

    The middle stream is 11–13, not 11–12: eleven to thirteen is exactly two
    years, so they fight together and fourteen is left on its own. The cut
    follows from the rule rather than from a tidy-looking guess.
    """
    assert band(CHILDREN, 2) == [
        ("8–9", ["ваня", "гриша"]),
        ("11–13", ["тимофей", "захар", "митя"]),
        ("14", ["лёшка"]),
    ]


def test_a_wider_gap_makes_fewer_streams():
    assert band(CHILDREN, 3) == [
        ("8–11", ["ваня", "гриша", "тимофей"]),
        ("12–14", ["захар", "митя", "лёшка"]),
    ]
    assert band(CHILDREN, 6) == [("8–14", ["ваня", "гриша", "тимофей", "захар", "митя", "лёшка"])]


def test_the_gap_is_a_difference_not_a_count():
    """A gap of 2 holds 8, 9 and 10 — three ages, two years apart."""
    assert band([("а", 8), ("б", 9), ("в", 10), ("г", 11)], 2) == [
        ("8–10", ["а", "б", "в"]),
        ("11", ["г"]),
    ]


def test_a_gap_of_zero_puts_every_age_on_its_own():
    assert band([("а", 8), ("б", 8), ("в", 9)], 0) == [("8", ["а", "б"]), ("9", ["в"])]


def test_one_age_is_never_split():
    assert band([("а", 12), ("б", 12), ("в", 12)], 2) == [("12", ["а", "б", "в"])]


def test_the_cut_is_minimal_and_never_leaves_a_stream_too_wide():
    for gap in range(0, 7):
        bands = eligibility.split_into_age_bands(CHILDREN, max_gap=gap)
        # every stream honours the rule…
        assert all(b.max_age - b.min_age <= gap for b in bands)
        # …everyone is placed exactly once…
        placed = [pid for b in bands for pid in b.participant_ids]
        assert sorted(placed) == sorted(pid for pid, _ in CHILDREN)
        # …and no two streams could have been merged into one.
        for earlier, later in zip(bands, bands[1:]):
            assert later.max_age - earlier.min_age > gap


def test_a_stream_of_one_is_reported_not_folded_into_its_neighbour():
    """Merging it would break the very rule the gap expresses."""
    bands = eligibility.split_into_age_bands([("малой", 8), ("средний", 12), ("старший", 13)], max_gap=2)
    assert [b.label for b in bands] == ["8", "12–13"]
    assert bands[0].is_lonely is True
    assert bands[1].is_lonely is False


def test_an_empty_field_yields_no_streams():
    assert eligibility.split_into_age_bands([], max_gap=2) == []


def test_a_negative_gap_is_refused():
    with pytest.raises(ValueError):
        eligibility.split_into_age_bands(CHILDREN, max_gap=-1)
