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


def entrant(name: str, *, city: str | None = None, seed: int | None = None) -> bracket_domain.Entrant:
    """An entrant whose participant id is derived from its name, for readable failures."""
    return bracket_domain.Entrant(
        participant_id=f"id-{name.lower()}", display_name=name, city=city, seed=seed
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
