"""Group stage: dealing the field into subgroups, and reading the result.

Nine fighters do not make a bracket anyone wants. They make two subgroups who
fight everyone in their own group, and the best of each go on. The shape is
sketched in ``docs/tournament-engine.md`` («если участников мало» → каждый с
каждым → полуфиналы), but the numbers are not — how many groups, how many
advance — and `docs/domain-model.md` §5 forbids inventing tournament formats.
So :func:`suggest_group_layout` enumerates every *valid* option and marks one
as advice; the organizer picks, and the service refuses to proceed without an
explicit choice.

Two things here are deliberately strict:

* **Ranking a group never guesses.** Equal records go to head-to-head, and
  whatever that cannot separate comes back as an :class:`UnresolvedTie` rather
  than being broken by name, seed or coin flip — a place in a group *causes* a
  playoff slot, so an invented order would decide who fights for the title.
  (:func:`app...read_service.standings` does break ties by name, and is right
  to: it produces a display order and marks the tie honestly. The two must not
  be "harmonized".)
* **Qualifiers are ordered, not paired.** :func:`order_qualifiers` lays them out
  A1, B1, A2, B2, A3, B3 and hands them to the ordinary bracket planner as
  seeds 1..n. ``standard_seed_order`` then produces the cross-seeded playoff by
  itself — with two groups of three advancing it gives A1 a bye, B2 against A3,
  B1 a bye and A2 against B3, which is the required shape with no second
  algorithm to keep in step.

Pure, like :mod:`app.modules.tournaments.domain.bracket`: no session, no HTTP.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from itertools import combinations
from typing import Mapping, Sequence

from app.modules.tournaments.domain.bracket import (
    MAX_SWAP_PASSES,
    SEPARATION_KINDS,
    BracketPlan,
    Entrant,
    SeparationCollision,
    build_plan,
    next_power_of_two,
    rank_entrants,
)

#: Group letters. Beyond eight groups an event is not a group stage any more.
GROUP_LETTERS = "АБВГДЕЖЗ"

#: What the suggestion aims for when nothing else distinguishes two options.
PREFERRED_GROUP_SIZE = range(4, 7)
PREFERRED_ADVANCE = 2


def group_name(ordinal: int) -> str:
    """«Группа А», «Группа Б», … and a plain number past the alphabet."""
    if 1 <= ordinal <= len(GROUP_LETTERS):
        return f"Группа {GROUP_LETTERS[ordinal - 1]}"
    return f"Группа {ordinal}"


def group_sizes(participant_count: int, group_count: int) -> tuple[int, ...]:
    """How many fighters land in each group, largest first.

    Nine into two is five and four, not four and a half; the remainder is
    spread one per group rather than dumped on the last one.
    """
    base, remainder = divmod(participant_count, group_count)
    return tuple(base + 1 if index < remainder else base for index in range(group_count))


# ----------------------------------------------------------------- suggestion


@dataclass(frozen=True)
class GroupLayoutOption:
    group_count: int
    advance_per_group: int
    group_sizes: tuple[int, ...]
    qualifier_count: int
    bracket_size: int
    bye_count: int
    is_default: bool
    note: str


@dataclass(frozen=True)
class GroupLayoutSuggestion:
    participant_count: int
    options: list[GroupLayoutOption]
    rationale: str


def suggest_group_layout(participant_count: int) -> GroupLayoutSuggestion:
    """Every valid way to split this field, with one marked as advice.

    Valid means each group can spare the fighters it advances (a group of three
    that advances three has not decided anything) and at least two qualifiers
    come out, so there is a playoff to hold.

    The marked option is a preference, not a rule, and the caller is required to
    state its own numbers regardless — see ``GroupService.generate``.
    """
    options: list[GroupLayoutOption] = []
    if participant_count >= 3:
        for group_count in range(1, min(len(GROUP_LETTERS), participant_count // 2) + 1):
            sizes = group_sizes(participant_count, group_count)
            smallest = min(sizes)
            for advance in range(1, smallest):
                qualifiers = advance * group_count
                if qualifiers < 2:
                    continue
                bracket_size = next_power_of_two(qualifiers)
                options.append(
                    GroupLayoutOption(
                        group_count=group_count,
                        advance_per_group=advance,
                        group_sizes=sizes,
                        qualifier_count=qualifiers,
                        bracket_size=bracket_size,
                        bye_count=bracket_size - qualifiers,
                        is_default=False,
                        note=_describe_option(sizes, advance),
                    )
                )

    default_index = _pick_default(options)
    if default_index is not None:
        marked = options[default_index]
        options[default_index] = GroupLayoutOption(**{**vars(marked), "is_default": True})

    return GroupLayoutSuggestion(
        participant_count=participant_count,
        options=options,
        rationale=(
            "Подсказка, а не правило: число подгрупп и число выходящих задаёт организатор. "
            "Отмеченный вариант — просто самый обычный для такого состава."
        ),
    )


def _describe_option(sizes: tuple[int, ...], advance: int) -> str:
    spread = "по " + str(sizes[0]) if len(set(sizes)) == 1 else " и ".join(str(size) for size in sizes)
    who = {1: "выходит один", 2: "выходят двое", 3: "выходят трое"}.get(advance, f"выходят {advance}")
    return f"{spread} бойцов, {who}"


def _pick_default(options: Sequence[GroupLayoutOption]) -> int | None:
    """Groups of 4–6 advancing two, else the fewest byes, else the fewest groups."""
    if not options:
        return None
    best = min(
        range(len(options)),
        key=lambda index: (
            0 if all(size in PREFERRED_GROUP_SIZE for size in options[index].group_sizes) else 1,
            0 if options[index].advance_per_group == PREFERRED_ADVANCE else 1,
            options[index].bye_count,
            options[index].group_count,
        ),
    )
    return best


# ---------------------------------------------------------------- the dealing


@dataclass
class GroupSlot:
    ordinal: int
    name: str
    advance_count: int
    entrants: list[Entrant] = field(default_factory=list)


def _shared_key_cost(group: GroupSlot) -> int:
    """How many "own" pairs this group holds, club weighted above city.

    A pair counts once, for the highest-priority key it shares, which is what
    keeps splitting a club from looking like an improvement on paper while it
    quietly creates a city clash.
    """
    cost = 0
    for first, second in combinations(group.entrants, 2):
        for weight, kind in enumerate(SEPARATION_KINDS):
            key_a, key_b = first.key_for(kind), second.key_for(kind)
            if key_a is not None and key_a == key_b:
                cost += len(SEPARATION_KINDS) - weight
                break
    return cost


def _total_cost(groups: Sequence[GroupSlot]) -> int:
    return sum(_shared_key_cost(group) for group in groups)


def distribute_into_groups(
    entrants: Sequence[Entrant],
    *,
    group_count: int,
    advance_per_group: int,
    rng: secrets.SystemRandom | None = None,
) -> tuple[list[GroupSlot], list[SeparationCollision]]:
    """Deal the field into groups, keeping clubmates and townsmen apart.

    Serpentine by rank (1→А, 2→Б, 3→Б, 4→А …), which is the ordinary way to
    spread seeded strength evenly rather than stacking it in one group. Then a
    repair pass swaps single fighters between groups while that strictly lowers
    the number of "own" pairs — monotonically decreasing over a bounded integer,
    so it terminates by construction.

    Whatever still shares a club or a city comes back reported, never hidden;
    the same honesty rule the first-round constraint follows.
    """
    if group_count < 1:
        raise ValueError("A group stage needs at least one group")
    ranked = rank_entrants(entrants, rng=rng)

    groups = [
        GroupSlot(ordinal=index + 1, name=group_name(index + 1), advance_count=advance_per_group)
        for index in range(group_count)
    ]
    # Serpentine: forward across the groups, then back, so no group is always
    # handed the stronger of each pair.
    for position, entrant in enumerate(ranked):
        lap, offset = divmod(position, group_count)
        index = offset if lap % 2 == 0 else group_count - 1 - offset
        groups[index].entrants.append(entrant)

    for _ in range(MAX_SWAP_PASSES):
        improved = False
        for left, right in combinations(range(group_count), 2):
            for i, a in enumerate(groups[left].entrants):
                for j, b in enumerate(groups[right].entrants):
                    before = _shared_key_cost(groups[left]) + _shared_key_cost(groups[right])
                    groups[left].entrants[i], groups[right].entrants[j] = b, a
                    after = _shared_key_cost(groups[left]) + _shared_key_cost(groups[right])
                    if after < before:
                        improved = True
                        break
                    groups[left].entrants[i], groups[right].entrants[j] = a, b
                else:
                    continue
                break
        if not improved:
            break

    return groups, _report_group_collisions(groups)


def _report_group_collisions(groups: Sequence[GroupSlot]) -> list[SeparationCollision]:
    found: list[SeparationCollision] = []
    for group in groups:
        for first, second in combinations(group.entrants, 2):
            for kind in SEPARATION_KINDS:
                key_a, key_b = first.key_for(kind), second.key_for(kind)
                if key_a is not None and key_a == key_b:
                    found.append(
                        SeparationCollision(
                            position=group.ordinal,
                            kind=kind,
                            value=first.label_for(kind) or key_a,
                            participant_a_id=first.participant_id,
                            participant_b_id=second.participant_id,
                            participant_a_name=first.display_name,
                            participant_b_name=second.display_name,
                        )
                    )
                    break
    return found


# --------------------------------------------------------------- the pairings


@dataclass(frozen=True)
class GroupPairing:
    group_ordinal: int
    #: Circle-method round, so bouts can be scheduled without two fighters
    #: being called at once.
    round_number: int
    position: int
    a: Entrant
    b: Entrant


def round_robin_pairings(group: GroupSlot, *, start_position: int = 1) -> list[GroupPairing]:
    """Everyone against everyone, by the circle method.

    An odd group sits one fighter out each round. That is a rest, **not** a bye
    — no match row exists for it, so it can never be mistaken for a free pass
    into anything or counted as a win.
    """
    fighters: list[Entrant | None] = list(group.entrants)
    if len(fighters) < 2:
        return []
    phantom = len(fighters) % 2 == 1
    if phantom:
        fighters.append(None)

    size = len(fighters)
    pairings: list[GroupPairing] = []
    position = start_position
    order = list(fighters)
    for round_index in range(size - 1):
        for slot in range(size // 2):
            first, second = order[slot], order[size - 1 - slot]
            if first is None or second is None:
                continue  # the sit-out; never becomes a match
            pairings.append(
                GroupPairing(
                    group_ordinal=group.ordinal,
                    round_number=round_index + 1,
                    position=position,
                    a=first,
                    b=second,
                )
            )
            position += 1
        order = [order[0], order[-1], *order[1:-1]]

    assert len(pairings) == len(group.entrants) * (len(group.entrants) - 1) // 2
    return pairings


@dataclass
class GroupPlan:
    group_count: int
    participant_count: int
    advance_per_group: int
    qualifier_count: int
    groups: list[GroupSlot] = field(default_factory=list)
    pairings: list[GroupPairing] = field(default_factory=list)
    unavoidable_collisions: list[SeparationCollision] = field(default_factory=list)
    strategy: str = "serpentine deal, club-then-city separation, round-robin per group"

    @property
    def separation_satisfied(self) -> bool:
        return not self.unavoidable_collisions

    @property
    def match_count(self) -> int:
        return len(self.pairings)


def build_group_plan(
    entrants: Sequence[Entrant],
    *,
    group_count: int,
    advance_per_group: int,
    rng: secrets.SystemRandom | None = None,
) -> GroupPlan:
    """Plan a group stage. Data only — nothing is persisted here."""
    entrant_list = list(entrants)
    if len(entrant_list) < 3:
        raise ValueError("A group stage needs at least three participants")
    if advance_per_group < 1:
        raise ValueError("At least one fighter must advance from each group")

    groups, collisions = distribute_into_groups(
        entrant_list, group_count=group_count, advance_per_group=advance_per_group, rng=rng
    )
    smallest = min(len(group.entrants) for group in groups)
    if smallest <= advance_per_group:
        raise ValueError(
            f"Из подгруппы в {smallest} бойцов не может выходить {advance_per_group}: "
            "групповой этап тогда ничего не решает"
        )

    pairings: list[GroupPairing] = []
    for group in groups:
        pairings.extend(round_robin_pairings(group, start_position=len(pairings) + 1))

    return GroupPlan(
        group_count=group_count,
        participant_count=len(entrant_list),
        advance_per_group=advance_per_group,
        qualifier_count=advance_per_group * group_count,
        groups=groups,
        pairings=pairings,
        unavoidable_collisions=collisions,
    )


# ------------------------------------------------------------------- ranking


@dataclass(frozen=True)
class GroupRecord:
    participant_id: str
    display_name: str
    played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    no_results: int = 0


@dataclass(frozen=True)
class GroupRank:
    rank: int | None
    participant_id: str
    record: GroupRecord
    #: "RECORD" | "HEAD_TO_HEAD" | "MANUAL", or None while unresolved.
    resolved_by: str | None


@dataclass(frozen=True)
class UnresolvedTie:
    participant_ids: tuple[str, ...]
    wins: int
    losses: int
    reason: str


@dataclass
class GroupRanking:
    ranks: list[GroupRank] = field(default_factory=list)
    unresolved: list[UnresolvedTie] = field(default_factory=list)
    #: Every bout of the group has a recorded result.
    complete: bool = False

    @property
    def is_decided(self) -> bool:
        return self.complete and not self.unresolved

    def qualifiers(self, count: int) -> list[GroupRank]:
        """The top ``count``, or nothing at all if the order is not settled."""
        if not self.is_decided:
            return []
        return [row for row in self.ranks if row.rank is not None and row.rank <= count]


def rank_group(
    records: Sequence[GroupRecord],
    head_to_head: Mapping[tuple[str, str], str | None],
    *,
    manual_order: Sequence[str] = (),
    complete: bool = True,
) -> GroupRanking:
    """Order a group, and say plainly what it could not order.

    Steps, in order, with no fourth one:

    1. by record — more wins first, then fewer losses;
    2. within a cluster of equal records, by the bouts those fighters had
       against *each other* (for two that is simply who won; for three or more
       it is a mini-table over their mutual bouts only, applied only when it is
       a strict total order);
    3. an explicit ``manual_order`` from the organizer, which beats head-to-head
       because they decided knowing it.

    Anything still tied is returned in ``unresolved``, and every member of that
    cluster keeps ``rank = None``. No name, no seed, no registration order, no
    coin flip.
    """
    by_id = {record.participant_id: record for record in records}
    manual_index = {participant_id: index for index, participant_id in enumerate(manual_order)}

    ordered = sorted(records, key=lambda record: (-record.wins, record.losses))
    ranking = GroupRanking(complete=complete)

    position = 1
    index = 0
    while index < len(ordered):
        cluster = [ordered[index]]
        while (
            index + len(cluster) < len(ordered)
            and (ordered[index + len(cluster)].wins, ordered[index + len(cluster)].losses)
            == (cluster[0].wins, cluster[0].losses)
        ):
            cluster.append(ordered[index + len(cluster)])
        index += len(cluster)

        ids = [record.participant_id for record in cluster]
        if len(cluster) == 1:
            ranking.ranks.append(
                GroupRank(position, ids[0], by_id[ids[0]], "RECORD")
            )
            position += 1
            continue

        if all(participant_id in manual_index for participant_id in ids):
            for participant_id in sorted(ids, key=lambda value: manual_index[value]):
                ranking.ranks.append(
                    GroupRank(position, participant_id, by_id[participant_id], "MANUAL")
                )
                position += 1
            continue

        settled = _resolve_by_head_to_head(ids, head_to_head)
        if settled is not None:
            for participant_id in settled:
                ranking.ranks.append(
                    GroupRank(position, participant_id, by_id[participant_id], "HEAD_TO_HEAD")
                )
                position += 1
            continue

        ranking.unresolved.append(
            UnresolvedTie(
                participant_ids=tuple(ids),
                wins=cluster[0].wins,
                losses=cluster[0].losses,
                reason=(
                    "очные встречи не разводят"
                    if len(cluster) == 2
                    else "круговая ничья: очные встречи не дают порядка"
                ),
            )
        )
        for participant_id in ids:
            ranking.ranks.append(GroupRank(None, participant_id, by_id[participant_id], None))
        position += len(ids)

    return ranking


def _resolve_by_head_to_head(
    ids: Sequence[str], head_to_head: Mapping[tuple[str, str], str | None]
) -> list[str] | None:
    """Order these fighters by their bouts against each other, or give up."""
    wins = {participant_id: 0 for participant_id in ids}
    played = 0
    for first, second in combinations(ids, 2):
        winner = head_to_head.get((first, second))
        if winner is None:
            winner = head_to_head.get((second, first))
        if winner is None:
            continue
        played += 1
        if winner in wins:
            wins[winner] += 1
    if played == 0:
        return None
    tally = sorted(wins.values(), reverse=True)
    if len(set(tally)) != len(tally):
        return None  # not a strict order; a 3-cycle lands here
    return sorted(ids, key=lambda participant_id: -wins[participant_id])


# ------------------------------------------------------- from groups to bracket


@dataclass(frozen=True)
class Qualifier:
    entrant: Entrant
    group_ordinal: int
    group_name: str
    place_in_group: int


def order_qualifiers(
    rankings: Mapping[int, GroupRanking],
    entrants_by_id: Mapping[str, Entrant],
    *,
    advance: Mapping[int, int],
) -> list[Qualifier]:
    """All the winners, then all the runners-up, then all the thirds.

    That order is the whole cross-seeding. Handed to the ordinary bracket
    planner as seeds 1..n, ``standard_seed_order`` puts the group winners in
    opposite halves and pairs each runner-up against a *different* group's
    third — so nobody meets a fellow group member in the first playoff round.
    """
    by_place: dict[int, list[Qualifier]] = {}
    for ordinal in sorted(rankings):
        ranking = rankings[ordinal]
        for row in ranking.qualifiers(advance.get(ordinal, 0)):
            assert row.rank is not None
            entrant = entrants_by_id.get(row.participant_id)
            if entrant is None:
                continue
            by_place.setdefault(row.rank, []).append(
                Qualifier(
                    entrant=entrant,
                    group_ordinal=ordinal,
                    group_name=group_name(ordinal),
                    place_in_group=row.rank,
                )
            )
    return [qualifier for place in sorted(by_place) for qualifier in by_place[place]]


def build_playoff_plan(
    qualifiers: Sequence[Qualifier],
    *,
    rng: secrets.SystemRandom | None = None,
) -> BracketPlan:
    """The knockout stage that follows the groups.

    Seeds are the qualifying order, and separation is *reported, not resolved*:
    swapping fighters here would undo the cross-seeding that is the point. With
    two groups of three advancing, A1 and A3 end up in the same half — that is
    arithmetic, not a bug (three fighters cannot be spread over two halves), so
    a same-group semifinal is possible and comes back as a ``GROUP`` collision
    for the organizer to see rather than being silently rearranged away.
    """
    seeded = [
        Entrant(
            participant_id=qualifier.entrant.participant_id,
            display_name=qualifier.entrant.display_name,
            city=qualifier.entrant.city,
            club=qualifier.entrant.club,
            seed=index + 1,
        )
        for index, qualifier in enumerate(qualifiers)
    ]
    plan = build_plan(seeded, rng=rng, separate=False)

    group_of = {q.entrant.participant_id: q for q in qualifiers}
    for pair in plan.first_round:
        if pair.a is None or pair.b is None:
            continue
        left, right = group_of.get(pair.a.participant_id), group_of.get(pair.b.participant_id)
        if left is not None and right is not None and left.group_ordinal == right.group_ordinal:
            plan.unavoidable_collisions.append(
                SeparationCollision(
                    position=pair.position,
                    kind="GROUP",
                    value=left.group_name,
                    participant_a_id=pair.a.participant_id,
                    participant_b_id=pair.b.participant_id,
                    participant_a_name=pair.a.display_name,
                    participant_b_name=pair.b.display_name,
                )
            )
    return plan
