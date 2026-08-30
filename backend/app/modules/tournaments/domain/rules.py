"""Competitive rules of the Mstinskaya Tradition, as data.

Source of the confirmed rules: buza.su, "Соревновательная практика Бузы
(Мстинская традиция)" by Сергей Шерстенников. Everything in this module that
comes from that page is marked SOURCE; everything the client decided on top of
it is marked CLIENT; the two gaps neither covers are marked FALLBACK and spell
out the reasoning, so nothing here is silently invented.

Vocabulary
----------
поединок / bout
    One pairing of two fighters. Persisted as a ``Match`` row.
соступ / round
    One exchange inside a поединок, fought to three points. Persisted as a
    ``MatchRound`` row. A поединок is at most three соступ.
жребий / lot
    The per-side draw that decides which weapon category a fighter uses in
    this поединок. Persisted as a ``MatchLot`` row.

This module is deliberately free of SQLAlchemy and FastAPI: it is the rule
engine, and it is unit-testable on its own.
"""

from __future__ import annotations

from dataclasses import dataclass

# --------------------------------------------------------------- categories

#: SOURCE — the three official lot categories: тростка, нож, безоружный.
#: CLIENT — «кистень» is a deliberate thematic addition by this platform and is
#: a full fourth category of the draw, not a footnote.
PALKA = "PALKA"  # тростка (stick)
NOZH = "NOZH"  # нож (knife)
HANDS = "HANDS"  # безоружный (unarmed)
KISTEN = "KISTEN"  # кистень — CLIENT addition

WEAPON_CATEGORIES: tuple[str, ...] = (PALKA, NOZH, HANDS, KISTEN)

WEAPON_LABELS_RU: dict[str, str] = {
    PALKA: "Тростка",
    NOZH: "Нож",
    HANDS: "Безоружный",
    KISTEN: "Кистень",
}

#: The armed categories. `HANDS` is the only unarmed one, and the asymmetric
#: win condition below keys off exactly that distinction.
ARMED_CATEGORIES: frozenset[str] = frozenset({PALKA, NOZH, KISTEN})

# --------------------------------------------------------------- the die

#: Four categories, so a four-sided die maps one face to one category with no
#: remainder and no re-roll rule to invent. Physical-die mode asks the judge for
#: the face value and applies exactly this table; online mode picks a face with
#: `secrets` and applies exactly the same table, so both modes are auditable
#: against one another.
DIE_SIDES = 4

DIE_FACE_TO_WEAPON: dict[int, str] = {
    1: PALKA,
    2: NOZH,
    3: HANDS,
    4: KISTEN,
}

LOT_METHOD_PHYSICAL = "PHYSICAL_DICE"
LOT_METHOD_ONLINE = "ONLINE_DICE"
LOT_METHODS: frozenset[str] = frozenset({LOT_METHOD_PHYSICAL, LOT_METHOD_ONLINE})


def weapon_for_die_face(face: int) -> str:
    """Map a d4 face to its weapon category, rejecting anything off the die."""
    try:
        return DIE_FACE_TO_WEAPON[int(face)]
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"Die face must be 1..{DIE_SIDES}, got {face!r}") from None


# ------------------------------------------------------------- соступ points

#: SOURCE — a соступ is fought to three points.
ROUND_TARGET_POINTS = 3

#: SOURCE — a поединок is three соступ.
#:
#: CLIENT CORRECTION: all three are always fought, even once one fighter has
#: mathematically clinched the поединок. The win condition below still decides
#: *who* wins; it no longer decides *when to stop*. The single exception is the
#: unarmed fighter's disarm, which by the original rule ends the whole duel on
#: the spot — see :attr:`ScoringAction.ends_bout`.
MAX_ROUNDS_PER_BOUT = 3


@dataclass(frozen=True)
class ScoringAction:
    """One judge-recorded scoring event inside a соступ.

    ``points is None`` means the primary source defines no point value for this
    action; such an action can only be recorded as an outright соступ win, never
    added to a running tally.
    """

    code: str
    weapon: str
    points: int | None
    #: Wins the соступ the moment it is recorded.
    ends_round: bool
    #: Wins the whole поединок the moment it is recorded.
    ends_bout: bool
    label_ru: str


#: SOURCE for нож, тростка and the unarmed disarm. CLIENT/FALLBACK for кистень:
#: no source defines kistenʹ strike values, so it carries no point tiers at all
#: — a кистень соступ is recorded as a binary win by the judge.
SCORING_ACTIONS: dict[str, ScoringAction] = {
    # --- нож: light wound = 1; accentuated cut/prick to body or head = 3;
    #     neck cut = 3 (either three-pointer is an immediate clean соступ win).
    "NOZH_LIGHT": ScoringAction(
        "NOZH_LIGHT", NOZH, 1, False, False, "Лёгкий укол или порез (конечность, голова, корпус)"
    ),
    "NOZH_ACCENTED": ScoringAction(
        "NOZH_ACCENTED", NOZH, 3, True, False, "Акцентированный порез или укол в корпус либо голову"
    ),
    "NOZH_NECK": ScoringAction("NOZH_NECK", NOZH, 3, True, False, "Порез шеи"),
    # --- тростка: head = 3 (clean соступ win), body jab = 2, limbs = 1.
    "PALKA_HEAD": ScoringAction(
        "PALKA_HEAD", PALKA, 3, True, False, "Акцентированный удар или тычок в голову"
    ),
    "PALKA_BODY": ScoringAction("PALKA_BODY", PALKA, 2, False, False, "Акцентированный тычок в корпус"),
    "PALKA_LIMB": ScoringAction("PALKA_LIMB", PALKA, 1, False, False, "Удар по конечностям"),
    # --- кистень: binary соступ win, no point tiers (no source defines any).
    "KISTEN_CLEAN": ScoringAction(
        "KISTEN_CLEAN", KISTEN, None, True, False, "Чистая победа в соступе (кистень)"
    ),
    # --- безоружный: the disarm is the only scoring event that matters, and it
    #     decides the whole поединок, not just the соступ.
    "DISARM": ScoringAction("DISARM", HANDS, None, True, True, "Обезоруживание"),
}


def actions_for_weapon(weapon: str) -> list[ScoringAction]:
    """The scoring actions a fighter holding ``weapon`` may be credited with."""
    return [action for action in SCORING_ACTIONS.values() if action.weapon == weapon]


def validate_action_for_weapon(action_code: str, weapon: str) -> ScoringAction:
    action = SCORING_ACTIONS.get(action_code)
    if action is None:
        raise ValueError(f"Unknown scoring action {action_code!r}")
    if action.weapon != weapon:
        raise ValueError(
            f"Action {action_code!r} belongs to {action.weapon}, "
            f"but this fighter drew {weapon}"
        )
    return action


# ------------------------------------------------------- win-condition engine


@dataclass(frozen=True)
class WinCondition:
    """How many соступ each side must win to take the поединок."""

    required_a: int
    required_b: int
    #: True when the two sides need a different number of соступ wins.
    asymmetric: bool
    explanation_ru: str


def win_condition(weapon_a: str, weapon_b: str) -> WinCondition:
    """Required соступ wins per side for this weapon matchup.

    SOURCE:

    * weapon vs weapon (same or different — нож/нож, тростка/тростка,
      нож/тростка): best of three, first to **2** соступ takes the поединок;
    * weapon vs unarmed: asymmetric — the unarmed fighter takes the whole
      поединок by disarming in a single соступ, while the armed fighter must win
      **all three** соступ.

    CLIENT: кистень follows the same two patterns — as a weapon against any
    weapon it is a race to 2, and against an unarmed fighter it is the same
    1-versus-3 asymmetry.

    FALLBACK: unarmed vs unarmed is reachable here only because кистень makes
    the draw four-way and both sides can still roll «безоружный»; the primary
    source never pairs two unarmed fighters. It is a symmetric matchup, so the
    symmetric rule — best of three — applies, rather than inventing a new one.
    """
    if weapon_a not in WEAPON_CATEGORIES:
        raise ValueError(f"Unknown weapon category {weapon_a!r}")
    if weapon_b not in WEAPON_CATEGORIES:
        raise ValueError(f"Unknown weapon category {weapon_b!r}")

    a_unarmed = weapon_a == HANDS
    b_unarmed = weapon_b == HANDS

    if a_unarmed and not b_unarmed:
        return WinCondition(
            1,
            3,
            True,
            "Безоружный побеждает в поединке, обезоружив соперника в одном соступе; "
            "вооружённый должен выиграть все три соступа.",
        )
    if b_unarmed and not a_unarmed:
        return WinCondition(
            3,
            1,
            True,
            "Безоружный побеждает в поединке, обезоружив соперника в одном соступе; "
            "вооружённый должен выиграть все три соступа.",
        )
    if a_unarmed and b_unarmed:
        return WinCondition(
            2,
            2,
            False,
            "Симметричная пара: поединок до двух выигранных соступов из трёх.",
        )
    return WinCondition(2, 2, False, "Поединок до двух выигранных соступов из трёх.")


#: SOURCE — a judge-facing staging note, not gameplay logic: before the «бой»
#: command in a нож/тростка pairing the knife fighter keeps the knife tucked in
#: the belt and the stick fighter holds the stick like a cane, a deliberate
#: distance handicap in the knife fighter's favour.
STAGING_NOTE_NOZH_VS_PALKA = (
    "До команды «бой» боец с ножом держит нож заткнутым за пояс, "
    "боец с тросткой держит тростку как трость — фора по дистанции в пользу ножа."
)


def staging_note(weapon_a: str, weapon_b: str) -> str | None:
    if {weapon_a, weapon_b} == {NOZH, PALKA}:
        return STAGING_NOTE_NOZH_VS_PALKA
    return None


def bout_winner_side(
    rounds_won_a: int,
    rounds_won_b: int,
    condition: WinCondition,
) -> str | None:
    """Which side, if either, has already taken the поединок.

    Returns ``"A"``, ``"B"`` or ``None``. Checked after every соступ; ties are
    impossible because the two thresholds can never both be met (each соступ
    credits exactly one side, and the two requirements sum to more than three
    only in the asymmetric case, where the short side needs a single win).
    """
    a_done = rounds_won_a >= condition.required_a
    b_done = rounds_won_b >= condition.required_b
    if a_done and not b_done:
        return "A"
    if b_done and not a_done:
        return "B"
    if a_done and b_done:
        # Defensive: cannot happen from a valid соступ sequence.
        return "A" if rounds_won_a >= rounds_won_b else "B"
    return None
