"""Read models for the tournament engine.

The write side (``schemas/engine.py``) mirrors the raw tables one-to-one, which
is fine for an organizer filling in data but forces a UI to resolve every
foreign key by hand. These views carry the resolved display names and the
aggregates a bracket / standings screen needs, so a page renders from one call.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ParticipantView(BaseModel):
    """A competitor as it is shown in a list, a bracket slot or a table row."""

    id: str
    competition_id: str | None = None
    tournament_id: str
    type: str
    display_name: str
    athlete_id: str | None = None
    team_id: str | None = None
    club_id: str | None = None
    #: Club as written on the entry. The first-round separation compares this,
    #: not `club_id`, because entries name clubs that may not exist as rows.
    club_name: str | None = None
    #: Registration city — the other half of that separation.
    city: str | None = None
    seed: int | None = None
    status: str


class TeamMemberView(BaseModel):
    id: str
    athlete_id: str
    display_name: str
    role: str | None = None


class TeamView(BaseModel):
    id: str
    competition_id: str
    name: str
    short_name: str | None = None
    club_id: str | None = None
    captain_id: str | None = None
    members: list[TeamMemberView] = Field(default_factory=list)


class MatchResultView(BaseModel):
    id: str
    match_id: str
    winner_id: str | None = None
    method: str
    comment: str | None = None
    recorded_at: datetime


class MatchView(BaseModel):
    id: str
    tournament_id: str
    competition_id: str | None = None
    draw_id: str | None = None
    bracket_id: str | None = None
    stage: str | None = None
    status: str
    round_number: int | None = None
    position: int | None = None
    participant_a: ParticipantView | None = None
    participant_b: ParticipantView | None = None
    winner_id: str | None = None
    result: MatchResultView | None = None
    #: A generated-bracket slot with one empty side. Shown explicitly, never as
    #: an invisible gap in the tree.
    is_bye: bool = False
    #: Where this bout's winner goes. The backend owns advancement; this is
    #: exposed so the tree can draw the connector, not so a client can move
    #: anyone.
    next_match_id: str | None = None
    next_slot: str | None = None
    #: Weapon on record per side: the drawn lot, or a final's fixed weapon.
    weapon_red: str | None = None
    weapon_blue: str | None = None
    #: True when this bout still needs a жребий before it can start.
    lot_required: bool = False
    lot_completed: bool = False
    rounds_won_red: int = 0
    rounds_won_blue: int = 0
    required_rounds_red: int | None = None
    required_rounds_blue: int | None = None


class CompetitionView(BaseModel):
    id: str
    tournament_id: str
    name: str
    description: str | None = None
    type: str
    format: str
    status: str
    participant_count: int = 0
    team_count: int = 0
    match_count: int = 0
    finished_match_count: int = 0


class DrawView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    competition_id: str
    name: str
    type: str
    status: str
    created_at: datetime


class BracketView(BaseModel):
    id: str
    competition_id: str
    draw_id: str | None = None
    name: str
    stage_type: str
    round: str | None = None
    position: int | None = None


class StandingsRow(BaseModel):
    """One line of the round-robin table.

    Only facts that follow from recorded results are exposed: no points and no
    official placement, because the rating system and tie-break rules are listed
    as unconfirmed in ``docs/domain-model.md`` §5 and must not be invented here.
    """

    position: int
    participant: ParticipantView
    played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    no_results: int = 0
    tied_with_previous: bool = False


class StandingsView(BaseModel):
    competition_id: str
    format: str
    rows: list[StandingsRow] = Field(default_factory=list)
    matches_total: int = 0
    matches_finished: int = 0
    #: True while any match still lacks a result — the order is provisional.
    provisional: bool = True
    #: Ordering is by wins then losses only; official tie-breaks are unconfirmed.
    ordering: str = "wins_desc,losses_asc,name_asc"


class BracketRoundView(BaseModel):
    """A single column of the playoff tree."""

    key: str
    label: str
    order: int
    matches: list[MatchView] = Field(default_factory=list)


class BracketTreeView(BaseModel):
    competition_id: str
    format: str
    rounds: list[BracketRoundView] = Field(default_factory=list)
    unassigned: list[MatchView] = Field(default_factory=list)


class CompetitionEventView(BaseModel):
    id: str
    competition_id: str
    event_type: str
    description: str | None = None
    payload: dict | None = None
    created_at: datetime


class ParticipantStatusHistoryView(BaseModel):
    id: str
    participant_id: str
    old_status: str | None = None
    new_status: str
    reason: str | None = None
    created_at: datetime


class AthleteParticipationView(BaseModel):
    """One competition an athlete entered, for their profile's history list.

    ``outcome`` only ever states facts that follow directly from recorded
    matches: who actually won the final, who reached it and lost, and what
    stage an eliminated fighter's run ended at. It deliberately does not
    compute a numeric placement (3rd, 4th, ...) — the platform has no bronze
    match and no confirmed tie-break rules (see ``StandingsRow``), so, like
    the standings table, it never implies an official rank it didn't compute.
    """

    participant_id: str
    tournament_id: str
    tournament_title: str
    competition_id: str
    competition_name: str
    format: str
    competition_status: str
    participant_status: str
    city: str | None = None
    seed: int | None = None
    #: CHAMPION/FINALIST come from the final's real result. ELIMINATED reports
    #: the stage a lost match happened at, never a place number. STANDINGS
    #: defers to the round-robin table row. IN_PROGRESS covers everything not
    #: decided yet; WITHDRAWN/DISQUALIFIED mirror the participant's own status.
    outcome: Literal[
        "CHAMPION",
        "FINALIST",
        "ELIMINATED",
        "STANDINGS",
        "IN_PROGRESS",
        "WITHDRAWN",
        "DISQUALIFIED",
    ] = "IN_PROGRESS"
    eliminated_at_stage: str | None = None
    #: Mirrors StandingsRow for a ROUND_ROBIN / GROUP_PLAYOFF entry.
    standings_wins: int | None = None
    standings_losses: int | None = None
    standings_position: int | None = None
    standings_tied: bool = False
    standings_provisional: bool = False


class MatchStatusUpdateRequest(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=2000)


class MatchResultUpdateRequest(BaseModel):
    """Correction of an already recorded result.

    The previous result is copied into a ``MATCH_UPDATED`` competition event
    before the row is rewritten, so the change stays traceable.
    """

    winner_id: str | None = None
    method: str
    comment: str | None = Field(default=None, max_length=4000)
    reason: str | None = Field(default=None, max_length=2000)
