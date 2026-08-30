"""Single-elimination bracket seeding.

Pure functions over plain dataclasses — no SQLAlchemy, no FastAPI — so the
algorithm is testable on its own and the persistence layer
(``services/bracket_service.py``) stays a thin writer.

The strategy, stated plainly because the project has no prior pairing rule and
``docs/architecture.md`` forbids inventing an elaborate one:

1. **Ranking.** Entrants carrying an explicit ``seed`` are ranked by it,
   ascending. Everyone else is shuffled and appended after them. So a seeded
   field behaves like a seeded field, and an unseeded field is a fair random
   draw.
2. **Slots.** Ranks are placed into the classic power-of-two bracket order
   (1 vs N, 2 vs N-1, …, arranged so rank 1 and rank 2 can only meet in the
   final).
3. **Byes.** The bracket is grown to the next power of two. Ranks beyond the
   real entrant count are *byes*: the standard consequence is that the top
   ranks get them. A bye is a real, persisted match with one empty side, never
   an invisible gap.
4. **City constraint (soft).** First-round pairs of two entrants from the same
   city are then resolved by greedy swaps between two fully-filled pairs, at
   most :data:`MAX_SWAP_PASSES` passes. Byes are never traded away to fix a
   collision — that would silently re-rank the field. Whatever collisions
   remain are *reported*, never hidden.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from typing import Sequence

#: Bounded so the resolver always terminates, however hostile the city
#: distribution is. Three passes is enough to settle the cascades a single swap
#: can create; beyond that the distribution is genuinely over-constrained.
MAX_SWAP_PASSES = 3


@dataclass(frozen=True)
class Entrant:
    """One competitor as the seeding algorithm sees them."""

    participant_id: str
    display_name: str
    city: str | None = None
    seed: int | None = None

    @property
    def city_key(self) -> str | None:
        """Cities are compared case- and whitespace-insensitively.

        Two spellings of the same city must collide, otherwise the constraint
        quietly does nothing for real, hand-typed data.
        """
        if not self.city:
            return None
        return " ".join(self.city.split()).casefold()


@dataclass
class PlannedPair:
    """One first-round slot pair. ``None`` on a side means a bye."""

    position: int
    a: Entrant | None
    b: Entrant | None

    @property
    def is_bye(self) -> bool:
        return (self.a is None) != (self.b is None)

    @property
    def is_empty(self) -> bool:
        return self.a is None and self.b is None

    @property
    def occupant(self) -> Entrant | None:
        """The single fighter of a bye pair."""
        return self.a if self.b is None else self.b


@dataclass(frozen=True)
class CityCollision:
    """A first-round pair the constraint could not separate."""

    position: int
    city: str
    participant_a_id: str
    participant_b_id: str
    participant_a_name: str
    participant_b_name: str


@dataclass
class BracketPlan:
    bracket_size: int
    participant_count: int
    bye_count: int
    round_count: int
    first_round: list[PlannedPair] = field(default_factory=list)
    unavoidable_collisions: list[CityCollision] = field(default_factory=list)
    strategy: str = "seeded-then-shuffled, standard slots, greedy city swaps"

    @property
    def city_constraint_satisfied(self) -> bool:
        return not self.unavoidable_collisions


# --------------------------------------------------------------- slot order


def next_power_of_two(value: int) -> int:
    size = 2
    while size < value:
        size *= 2
    return size


def standard_seed_order(size: int) -> list[int]:
    """Rank numbers in bracket-slot order for a power-of-two bracket.

    ``standard_seed_order(4) == [1, 4, 2, 3]`` — slots read in pairs, so rank 1
    meets rank 4 and rank 2 meets rank 3, and ranks 1 and 2 can only meet in the
    final. This is the ordinary knockout seeding used everywhere; it is not a
    project-specific invention.
    """
    if size < 1 or size & (size - 1):
        raise ValueError(f"Bracket size must be a power of two, got {size}")
    order = [1]
    while len(order) < size:
        span = len(order) * 2
        expanded: list[int] = []
        for rank in order:
            expanded.append(rank)
            expanded.append(span + 1 - rank)
        order = expanded
    return order


def stage_name_for_round(match_count: int) -> str:
    """Name of a round holding ``match_count`` matches."""
    return {1: "FINAL", 2: "SEMIFINAL", 4: "QUARTERFINAL"}.get(
        match_count, f"ROUND_OF_{match_count * 2}"
    )


# ------------------------------------------------------------------ ranking


def rank_entrants(entrants: Sequence[Entrant], *, rng: secrets.SystemRandom | None = None) -> list[Entrant]:
    """Seeded entrants first (by seed), then everyone else in random order."""
    random_source = rng or secrets.SystemRandom()
    seeded = sorted(
        (e for e in entrants if e.seed is not None),
        key=lambda e: (e.seed, e.display_name.casefold()),
    )
    unseeded = [e for e in entrants if e.seed is None]
    random_source.shuffle(unseeded)
    return [*seeded, *unseeded]


# ----------------------------------------------------------- city resolution


def _collision_city(pair: PlannedPair) -> str | None:
    if pair.a is None or pair.b is None:
        return None
    key_a, key_b = pair.a.city_key, pair.b.city_key
    if key_a is not None and key_a == key_b:
        return pair.a.city
    return None


def _swappable(pair: PlannedPair) -> bool:
    """Only fully-filled pairs may trade fighters — byes stay where they are."""
    return pair.a is not None and pair.b is not None


def resolve_city_collisions(pairs: list[PlannedPair]) -> list[CityCollision]:
    """Greedily separate same-city first-round pairs; report what is left.

    Bounded by :data:`MAX_SWAP_PASSES` full passes over the pair list, each
    trying at most four slot combinations against each other pair — so the worst
    case is O(passes · pairs² ) and the function always returns. It never claims
    success it did not achieve: whatever still collides comes back in the
    returned list.
    """
    for _ in range(MAX_SWAP_PASSES):
        made_progress = False
        for i, pair in enumerate(pairs):
            if _collision_city(pair) is None or not _swappable(pair):
                continue
            for j, other in enumerate(pairs):
                if i == j or not _swappable(other):
                    continue
                swapped = False
                for slot_i in ("a", "b"):
                    for slot_j in ("a", "b"):
                        mine = getattr(pair, slot_i)
                        theirs = getattr(other, slot_j)
                        setattr(pair, slot_i, theirs)
                        setattr(other, slot_j, mine)
                        if _collision_city(pair) is None and _collision_city(other) is None:
                            swapped = True
                            break
                        # Not an improvement — put both back and try the next
                        # slot combination.
                        setattr(pair, slot_i, mine)
                        setattr(other, slot_j, theirs)
                    if swapped:
                        break
                if swapped:
                    made_progress = True
                    break
        if not made_progress:
            break

    collisions: list[CityCollision] = []
    for pair in pairs:
        city = _collision_city(pair)
        if city is None:
            continue
        assert pair.a is not None and pair.b is not None
        collisions.append(
            CityCollision(
                position=pair.position,
                city=city,
                participant_a_id=pair.a.participant_id,
                participant_b_id=pair.b.participant_id,
                participant_a_name=pair.a.display_name,
                participant_b_name=pair.b.display_name,
            )
        )
    return collisions


# --------------------------------------------------------------- entry point


def build_plan(
    entrants: Sequence[Entrant],
    *,
    rng: secrets.SystemRandom | None = None,
) -> BracketPlan:
    """Plan a single-elimination bracket for ``entrants``.

    The plan is data only — nothing is persisted here, so a wizard can show the
    organizer the bye count and the city-collision verdict *before* they commit.
    """
    entrant_list = list(entrants)
    count = len(entrant_list)
    if count < 2:
        raise ValueError("A bracket needs at least two participants")

    bracket_size = next_power_of_two(count)
    ranked = rank_entrants(entrant_list, rng=rng)
    #: rank number (1-based) -> entrant; ranks above ``count`` are byes.
    by_rank = {index: entrant for index, entrant in enumerate(ranked, start=1)}

    slots = [by_rank.get(rank) for rank in standard_seed_order(bracket_size)]
    pairs = [
        PlannedPair(position=index + 1, a=slots[index * 2], b=slots[index * 2 + 1])
        for index in range(bracket_size // 2)
    ]

    collisions = resolve_city_collisions(pairs)

    round_count = bracket_size.bit_length() - 1
    return BracketPlan(
        bracket_size=bracket_size,
        participant_count=count,
        bye_count=bracket_size - count,
        round_count=round_count,
        first_round=pairs,
        unavoidable_collisions=collisions,
    )
