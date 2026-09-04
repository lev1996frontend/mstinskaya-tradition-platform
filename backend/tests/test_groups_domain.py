"""Unit tests for the pure group-stage planner.

The load-bearing ones are the last two sections: that a three-way cycle comes
back *unresolved* instead of being broken by some invented criterion, and that
ordering qualifiers A1, B1, A2, B2, A3, B3 through the ordinary bracket planner
produces the cross-seeded playoff by itself — no second algorithm to keep in
step with the first.
"""

from __future__ import annotations

import random
from itertools import combinations

import pytest

from app.modules.tournaments.domain import groups as group_domain
from app.modules.tournaments.domain.bracket import Entrant


def entrant(name: str, *, city: str | None = None, club: str | None = None, seed: int | None = None):
    return Entrant(
        participant_id=f"id-{name.lower()}", display_name=name, city=city, club=club, seed=seed
    )


def field_of(count: int, **kwargs) -> list[Entrant]:
    return [entrant(f"Боец{index}", **kwargs) for index in range(1, count + 1)]


def record(name: str, wins: int, losses: int) -> group_domain.GroupRecord:
    return group_domain.GroupRecord(
        participant_id=f"id-{name.lower()}",
        display_name=name,
        played=wins + losses,
        wins=wins,
        losses=losses,
    )


# ------------------------------------------------------------------ suggestion


def test_group_sizes_spread_the_remainder_one_per_group():
    assert group_domain.group_sizes(9, 2) == (5, 4)
    assert group_domain.group_sizes(10, 3) == (4, 3, 3)
    assert group_domain.group_sizes(8, 2) == (4, 4)


def test_group_names_are_russian_letters():
    assert group_domain.group_name(1) == "Группа А"
    assert group_domain.group_name(2) == "Группа Б"


def test_every_suggested_option_is_actually_playable():
    """A group cannot advance as many fighters as it holds."""
    for count in range(3, 33):
        suggestion = group_domain.suggest_group_layout(count)
        for option in suggestion.options:
            assert min(option.group_sizes) > option.advance_per_group
            assert sum(option.group_sizes) == count
            assert option.qualifier_count >= 2


def test_exactly_one_option_is_marked_as_advice():
    suggestion = group_domain.suggest_group_layout(9)
    assert sum(1 for option in suggestion.options if option.is_default) == 1
    assert "организатор" in suggestion.rationale


def test_nine_fighters_can_be_split_two_by_three():
    """The case from the brief: two subgroups, three out of each."""
    options = group_domain.suggest_group_layout(9).options
    match = [
        option
        for option in options
        if option.group_count == 2 and option.advance_per_group == 3
    ]
    assert len(match) == 1
    assert match[0].group_sizes == (5, 4)
    assert match[0].qualifier_count == 6
    assert (match[0].bracket_size, match[0].bye_count) == (8, 2)


def test_a_field_too_small_for_groups_offers_nothing():
    assert group_domain.suggest_group_layout(2).options == []


# ---------------------------------------------------------------- distribution


def test_the_deal_uses_every_fighter_once():
    people = field_of(9)
    slots, _ = group_domain.distribute_into_groups(
        people, group_count=2, advance_per_group=3, rng=random.Random(3)
    )
    dealt = [e.participant_id for slot in slots for e in slot.entrants]
    assert sorted(dealt) == sorted(e.participant_id for e in people)
    assert sorted(len(slot.entrants) for slot in slots) == [4, 5]


def test_the_deal_is_serpentine_so_seeds_are_spread():
    """Ranks 1 and 2 must not both land in one group."""
    people = [entrant(f"Боец{index}", seed=index) for index in range(1, 9)]
    slots, _ = group_domain.distribute_into_groups(
        people, group_count=2, advance_per_group=2, rng=random.Random(1)
    )
    where = {
        e.participant_id: slot.ordinal for slot in slots for e in slot.entrants
    }
    assert where["id-боец1"] != where["id-боец2"]


def test_clubmates_are_split_across_groups_when_there_is_room():
    people = [
        entrant("Иван", club="Буза"),
        entrant("Сергей", club="Буза"),
        entrant("Пётр", club="Сокол"),
        entrant("Фёдор", club="Сокол"),
        entrant("Гриша", club="Ратник"),
        entrant("Тихон", club="Ратник"),
    ]
    slots, collisions = group_domain.distribute_into_groups(
        people, group_count=2, advance_per_group=2, rng=random.Random(5)
    )
    assert collisions == []
    for slot in slots:
        clubs = [e.club for e in slot.entrants]
        assert len(clubs) == len(set(clubs))


def test_what_cannot_be_split_is_reported_not_hidden():
    """One club, one group's worth of them: somebody has to share."""
    people = [entrant(f"Боец{index}", club="Буза") for index in range(1, 5)]
    slots, collisions = group_domain.distribute_into_groups(
        people, group_count=2, advance_per_group=1, rng=random.Random(7)
    )
    assert collisions, "an unavoidable clash must come back in the report"
    assert {c.kind for c in collisions} == {"CLUB"}
    assert sum(len(slot.entrants) for slot in slots) == 4


# ------------------------------------------------------------------- pairings


@pytest.mark.parametrize("size", [2, 3, 4, 5, 6, 7])
def test_a_group_plays_every_pair_exactly_once(size: int):
    slot = group_domain.GroupSlot(
        ordinal=1, name="Группа А", advance_count=1, entrants=field_of(size)
    )
    pairings = group_domain.round_robin_pairings(slot)
    assert len(pairings) == size * (size - 1) // 2
    seen = {
        frozenset((pairing.a.participant_id, pairing.b.participant_id)) for pairing in pairings
    }
    assert len(seen) == len(pairings), "a pair was scheduled twice"
    assert seen == {
        frozenset((a.participant_id, b.participant_id))
        for a, b in combinations(slot.entrants, 2)
    }


def test_an_odd_group_produces_a_rest_not_a_bye_match():
    """The sit-out must never become a match row, or it reads as a free pass."""
    slot = group_domain.GroupSlot(
        ordinal=1, name="Группа А", advance_count=1, entrants=field_of(5)
    )
    pairings = group_domain.round_robin_pairings(slot)
    assert len(pairings) == 10
    assert all(pairing.a is not None and pairing.b is not None for pairing in pairings)


def test_nobody_fights_twice_in_one_round():
    slot = group_domain.GroupSlot(
        ordinal=1, name="Группа А", advance_count=1, entrants=field_of(6)
    )
    by_round: dict[int, list[str]] = {}
    for pairing in group_domain.round_robin_pairings(slot):
        by_round.setdefault(pairing.round_number, []).extend(
            [pairing.a.participant_id, pairing.b.participant_id]
        )
    for fighters in by_round.values():
        assert len(fighters) == len(set(fighters))


def test_positions_are_unique_across_the_whole_stage():
    plan = group_domain.build_group_plan(
        field_of(9), group_count=2, advance_per_group=3, rng=random.Random(2)
    )
    positions = [pairing.position for pairing in plan.pairings]
    assert sorted(positions) == list(range(1, len(positions) + 1))
    # 5 fighters → 10 bouts, 4 fighters → 6 bouts.
    assert plan.match_count == 16


def test_a_group_that_advances_everyone_is_refused():
    with pytest.raises(ValueError):
        group_domain.build_group_plan(field_of(6), group_count=2, advance_per_group=3)


def test_a_field_too_small_for_a_group_stage_is_refused():
    with pytest.raises(ValueError):
        group_domain.build_group_plan(field_of(2), group_count=1, advance_per_group=1)


# -------------------------------------------------------------------- ranking


def beat(winner: str, loser: str) -> dict:
    return {(f"id-{winner.lower()}", f"id-{loser.lower()}"): f"id-{winner.lower()}"}


def test_a_clear_group_is_ranked_by_record():
    ranking = group_domain.rank_group(
        [record("Иван", 3, 0), record("Пётр", 2, 1), record("Сергей", 0, 3)], {}
    )
    assert [row.rank for row in ranking.ranks] == [1, 2, 3]
    assert {row.resolved_by for row in ranking.ranks} == {"RECORD"}
    assert ranking.is_decided


def test_two_level_fighters_are_separated_by_their_own_bout():
    ranking = group_domain.rank_group(
        [record("Иван", 2, 1), record("Пётр", 2, 1)], beat("Пётр", "Иван")
    )
    assert [row.participant_id for row in ranking.ranks] == ["id-пётр", "id-иван"]
    assert {row.resolved_by for row in ranking.ranks} == {"HEAD_TO_HEAD"}
    assert ranking.unresolved == []


def test_a_resolvable_three_way_uses_their_mutual_bouts():
    head_to_head = {**beat("Иван", "Пётр"), **beat("Иван", "Сергей"), **beat("Пётр", "Сергей")}
    ranking = group_domain.rank_group(
        [record("Иван", 2, 1), record("Пётр", 2, 1), record("Сергей", 2, 1)], head_to_head
    )
    assert [row.participant_id for row in ranking.ranks] == ["id-иван", "id-пётр", "id-сергей"]
    assert ranking.unresolved == []


def test_a_three_way_cycle_comes_back_unresolved():
    """А beat Б, Б beat В, В beat А. There is no honest order, so none is invented."""
    head_to_head = {**beat("Иван", "Пётр"), **beat("Пётр", "Сергей"), **beat("Сергей", "Иван")}
    ranking = group_domain.rank_group(
        [record("Иван", 1, 1), record("Пётр", 1, 1), record("Сергей", 1, 1)], head_to_head
    )
    assert len(ranking.unresolved) == 1
    assert set(ranking.unresolved[0].participant_ids) == {"id-иван", "id-пётр", "id-сергей"}
    assert all(row.rank is None for row in ranking.ranks)
    assert not ranking.is_decided
    assert ranking.qualifiers(2) == []


def test_the_organizer_can_settle_what_the_bouts_could_not():
    head_to_head = {**beat("Иван", "Пётр"), **beat("Пётр", "Сергей"), **beat("Сергей", "Иван")}
    ranking = group_domain.rank_group(
        [record("Иван", 1, 1), record("Пётр", 1, 1), record("Сергей", 1, 1)],
        head_to_head,
        manual_order=["id-сергей", "id-иван", "id-пётр"],
    )
    assert ranking.unresolved == []
    assert [row.participant_id for row in ranking.ranks] == ["id-сергей", "id-иван", "id-пётр"]
    assert {row.resolved_by for row in ranking.ranks} == {"MANUAL"}


def test_an_incomplete_group_is_never_decided():
    ranking = group_domain.rank_group(
        [record("Иван", 1, 0), record("Пётр", 0, 1)], {}, complete=False
    )
    assert ranking.unresolved == []
    assert not ranking.is_decided
    assert ranking.qualifiers(1) == []


# --------------------------------------------------- groups into the playoff


def decided(names: list[str], ordinal: int) -> group_domain.GroupRanking:
    """A group whose order came out clean, best first."""
    return group_domain.rank_group(
        [record(name, len(names) - index, index) for index, name in enumerate(names)],
        {},
    )


def test_qualifiers_are_ordered_winners_then_runners_up_then_thirds():
    rankings = {
        1: decided(["А1", "А2", "А3"], 1),
        2: decided(["Б1", "Б2", "Б3"], 2),
    }
    entrants = {f"id-{name.lower()}": entrant(name) for name in ["А1", "А2", "А3", "Б1", "Б2", "Б3"]}
    ordered = group_domain.order_qualifiers(rankings, entrants, advance={1: 3, 2: 3})
    assert [q.entrant.display_name for q in ordered] == ["А1", "Б1", "А2", "Б2", "А3", "Б3"]


def test_the_playoff_is_cross_seeded_without_a_second_algorithm():
    """The shape the organizer asked for, produced by `standard_seed_order`."""
    rankings = {
        1: decided(["А1", "А2", "А3"], 1),
        2: decided(["Б1", "Б2", "Б3"], 2),
    }
    entrants = {f"id-{name.lower()}": entrant(name) for name in ["А1", "А2", "А3", "Б1", "Б2", "Б3"]}
    ordered = group_domain.order_qualifiers(rankings, entrants, advance={1: 3, 2: 3})
    plan = group_domain.build_playoff_plan(ordered)

    assert (plan.bracket_size, plan.bye_count) == (8, 2)
    pairs = [
        (
            pair.a.display_name if pair.a else None,
            pair.b.display_name if pair.b else None,
        )
        for pair in plan.first_round
    ]
    assert pairs == [("А1", None), ("Б2", "А3"), ("Б1", None), ("А2", "Б3")]
    # The two group winners hold the byes.
    byes = [pair.occupant.display_name for pair in plan.first_round if pair.is_bye]
    assert sorted(byes) == ["А1", "Б1"]


def test_the_documented_five_fighter_case_falls_out_of_the_same_code():
    """One group of five, four advance → 1v4 and 2v3, per docs/tournament-engine.md."""
    rankings = {1: decided(["Первый", "Второй", "Третий", "Четвёртый"], 1)}
    entrants = {
        f"id-{name.lower()}": entrant(name)
        for name in ["Первый", "Второй", "Третий", "Четвёртый"]
    }
    ordered = group_domain.order_qualifiers(rankings, entrants, advance={1: 4})
    plan = group_domain.build_playoff_plan(ordered)

    assert (plan.bracket_size, plan.bye_count) == (4, 0)
    pairs = [(pair.a.display_name, pair.b.display_name) for pair in plan.first_round]
    assert pairs == [("Первый", "Четвёртый"), ("Второй", "Третий")]


def test_a_same_group_playoff_pair_is_reported_not_rearranged():
    """Three from one group cannot be spread over two halves; say so, don't hide it."""
    rankings = {
        1: decided(["А1", "А2", "А3"], 1),
        2: decided(["Б1", "Б2", "Б3"], 2),
    }
    entrants = {f"id-{name.lower()}": entrant(name) for name in ["А1", "А2", "А3", "Б1", "Б2", "Б3"]}
    ordered = group_domain.order_qualifiers(rankings, entrants, advance={1: 3, 2: 3})
    plan = group_domain.build_playoff_plan(ordered)
    # No first-round pair is from one group — that is the cross-seeding working.
    assert [c for c in plan.unavoidable_collisions if c.kind == "GROUP"] == []


def test_no_first_round_pair_is_from_one_group():
    """Checked over the pairs themselves, not only over the reported collisions."""
    rankings = {
        1: decided(["А1", "А2", "А3"], 1),
        2: decided(["Б1", "Б2", "Б3"], 2),
    }
    entrants = {f"id-{name.lower()}": entrant(name) for name in ["А1", "А2", "А3", "Б1", "Б2", "Б3"]}
    ordered = group_domain.order_qualifiers(rankings, entrants, advance={1: 3, 2: 3})
    plan = group_domain.build_playoff_plan(ordered)
    for pair in plan.first_round:
        if pair.a and pair.b:
            assert pair.a.display_name[0] != pair.b.display_name[0]


def test_an_undecided_group_yields_no_qualifiers_at_all():
    head_to_head = {**beat("Иван", "Пётр"), **beat("Пётр", "Сергей"), **beat("Сергей", "Иван")}
    stuck = group_domain.rank_group(
        [record("Иван", 1, 1), record("Пётр", 1, 1), record("Сергей", 1, 1)], head_to_head
    )
    entrants = {f"id-{name.lower()}": entrant(name) for name in ["Иван", "Пётр", "Сергей"]}
    assert group_domain.order_qualifiers({1: stuck}, entrants, advance={1: 2}) == []
