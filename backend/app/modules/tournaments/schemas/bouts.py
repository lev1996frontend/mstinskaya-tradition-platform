"""Wire models for bracket generation, the жребий and the соступ."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.tournaments.domain import rules
from app.modules.tournaments.schemas.views import MatchView

WeaponCategory = Literal["PALKA", "NOZH", "HANDS", "KISTEN"]
LotMethod = Literal["PHYSICAL_DICE", "ONLINE_DICE"]
Side = Literal["RED", "BLUE"]

# ------------------------------------------------------------------ bracket


class BracketGenerateRequest(BaseModel):
    """Options for generating a single-elimination bracket."""

    #: The final draws no lot, so its weapon comes from the tournament's own
    #: rules. ``None`` leaves it open and the judge records соступ winners
    #: without a weapon on record.
    final_weapon: WeaponCategory | None = None


class FirstRoundPairPlan(BaseModel):
    position: int
    is_bye: bool
    participant_a_id: str | None = None
    participant_a_name: str | None = None
    participant_a_city: str | None = None
    participant_b_id: str | None = None
    participant_b_name: str | None = None
    participant_b_city: str | None = None


class CityCollisionView(BaseModel):
    """A pair the draw could not separate.

    ``kind`` says what they share; ``value`` is that club or city. ``city`` and
    ``club`` are the same value narrowed to one kind each, so a client can show
    "земляки" and "одноклубники" differently without parsing ``kind``.
    """

    position: int
    kind: str = "CITY"
    value: str
    city: str | None = None
    club: str | None = None
    participant_a_id: str
    participant_b_id: str
    participant_a_name: str
    participant_b_name: str


class BracketPlanView(BaseModel):
    """What the wizard shows before the organizer commits."""

    bracket_size: int
    participant_count: int
    bye_count: int
    round_count: int
    strategy: str
    #: False when same-city first-round pairs could not all be avoided. The
    #: collisions are then listed rather than silently accepted.
    city_constraint_satisfied: bool
    #: Narrower than the above: false when *any* club or city clash is left.
    separation_satisfied: bool = True
    unavoidable_collisions: list[CityCollisionView] = Field(default_factory=list)
    first_round: list[FirstRoundPairPlan] = Field(default_factory=list)


# ---------------------------------------------------------------------- lot


class LotDrawRequest(BaseModel):
    side: Side
    method: LotMethod
    #: Required for PHYSICAL_DICE — the face the judge actually rolled. Ignored
    #: for ONLINE_DICE, where the server rolls with `secrets` and the client
    #: never supplies or computes a value.
    die_value: int | None = Field(default=None, ge=1, le=rules.DIE_SIDES)


class LotOverrideRequest(LotDrawRequest):
    """Admin correction. The reason is mandatory and lands in the journal."""

    reason: str = Field(..., min_length=3, max_length=2000)


class LotView(BaseModel):
    id: str
    side: Side
    method: LotMethod
    die_value: int
    weapon: WeaponCategory
    sequence: int
    created_at: datetime


# -------------------------------------------------------------------- соступ


class RoundScoreRequest(BaseModel):
    participant_id: str
    #: A key of ``domain.rules.SCORING_ACTIONS``, validated against the weapon
    #: that fighter actually drew.
    action_code: str = Field(..., min_length=2, max_length=30)


class RoundCompleteRequest(BaseModel):
    winner_participant_id: str
    end_reason: Literal["JUDGE_DECISION", "WITHDRAWAL", "KISTEN_CLEAN", "DISARM", "POINTS", "CLEAN_HIT"] = (
        "JUDGE_DECISION"
    )
    notes: str | None = Field(default=None, max_length=2000)


class RoundScoreView(BaseModel):
    id: str
    participant_id: str
    action_code: str
    weapon: str
    points: int | None = None
    label: str


class MatchRoundView(BaseModel):
    id: str
    round_number: int
    status: str
    points_red: int
    points_blue: int
    winner_id: str | None = None
    end_reason: str | None = None
    notes: str | None = None
    scores: list[RoundScoreView] = Field(default_factory=list)


class BoutDetailView(BaseModel):
    """Everything a judge screen needs for one поединок."""

    match: MatchView
    is_final: bool
    is_bye: bool
    #: False for a final and for a team pairing — neither draws a weapon.
    lot_required: bool
    weapon_red: WeaponCategory | None = None
    weapon_blue: WeaponCategory | None = None
    required_rounds_red: int | None = None
    required_rounds_blue: int | None = None
    win_condition_note: str | None = None
    #: Judge-facing staging note, currently only for нож vs тростка.
    staging_note: str | None = None
    lots: list[LotView] = Field(default_factory=list)
    rounds: list[MatchRoundView] = Field(default_factory=list)
    rounds_won_red: int = 0
    rounds_won_blue: int = 0
    max_rounds: int = rules.MAX_ROUNDS_PER_BOUT


# ------------------------------------------------------------------ summary


class ChampionPathEntry(BaseModel):
    match_id: str
    stage: str | None = None
    round_number: int | None = None
    is_bye: bool = False
    opponent: dict | None = None
    won: bool = False
    weapon: str | None = None
    opponent_weapon: str | None = None
    rounds_won: int = 0


class ChampionSummaryView(BaseModel):
    competition_id: str
    #: False while the final is still open — never a guessed champion.
    complete: bool
    champion: dict | None = None
    path: list[ChampionPathEntry] = Field(default_factory=list)
    completed_at: datetime | None = None


# ------------------------------------------------------------ team bouts 3x3


class TeamPairingResultRequest(BaseModel):
    winner_participant_id: str
    notes: str | None = Field(default=None, max_length=2000)


class TeamBoutView(BaseModel):
    id: str
    competition_id: str
    team_red_id: str
    team_blue_id: str
    team_red_name: str
    team_blue_name: str
    status: str
    wins_red: int
    wins_blue: int
    winner_team_id: str | None = None
    round_number: int | None = None
    position: int | None = None
    pairings: list[MatchView] = Field(default_factory=list)


# ------------------------------------------------------------- rule reference


class ScoringActionView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    weapon: str
    points: int | None
    ends_round: bool
    ends_bout: bool
    label_ru: str


class WeaponRulesView(BaseModel):
    """The confirmed ruleset, served so the UI never hard-codes a second copy."""

    weapons: list[dict]
    die_sides: int
    die_face_to_weapon: dict[int, str]
    actions: list[ScoringActionView]
    round_target_points: int
    max_rounds_per_bout: int
    staging_note_nozh_vs_palka: str


# ----------------------------------------------------------------- withdrawal


class ParticipantWithdrawRequest(BaseModel):
    """Taking a fighter out of a competition that has already started.

    ``reason`` is required, not optional: a walkover changes who reaches the
    next round, and the journal has to be able to say why. The same rule the
    lot override already follows.
    """

    reason: str = Field(min_length=3, max_length=2000)
    status: Literal["WITHDRAWN", "DISQUALIFIED"] = "WITHDRAWN"


class WalkoverView(BaseModel):
    match_id: str
    stage: str | None = None
    opponent_id: str


class PendingWalkoverView(BaseModel):
    """A bout that cannot be awarded yet, because the opponent is undecided."""

    match_id: str
    stage: str | None = None


class WithdrawalView(BaseModel):
    participant_id: str
    from_status: str
    to_status: str
    reason: str
    walkovers: list[WalkoverView] = Field(default_factory=list)
    pending_walkovers: list[PendingWalkoverView] = Field(default_factory=list)
