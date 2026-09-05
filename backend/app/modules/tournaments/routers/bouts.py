"""Bracket generation, the жребий, the соступ and the team phase.

Reads are public, like the rest of the tournament read side. Every **write**
here is guarded by :func:`get_current_manager` — the tournament's organizer or
a user holding an instructor role. That guard is new and applies to this router
only; the pre-existing tournament routes were deliberately left as they were,
so no existing client breaks.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.tournaments.domain import rules
from app.modules.tournaments.schemas.bouts import (
    AgeSplitResultView,
    AgeSplitView,
    BoutDetailView,
    BracketGenerateRequest,
    BracketPlanView,
    ChampionSummaryView,
    GroupLayoutSuggestionView,
    GroupPlanView,
    GroupStageConfigRequest,
    GroupStageView,
    GroupTieBreakRequest,
    LotDrawRequest,
    LotOverrideRequest,
    LotView,
    MatchRoundView,
    ParticipantWithdrawRequest,
    QualificationView,
    RoundCompleteRequest,
    RoundScoreRequest,
    ScoringActionView,
    TeamBoutView,
    TeamPairingResultRequest,
    WeaponRulesView,
    WithdrawalView,
)
from app.modules.tournaments.schemas.views import MatchView
from app.modules.tournaments.security.deps import (
    TournamentManager,
    ensure_can_manage_competition,
    ensure_can_manage_match,
    ensure_can_manage_participant,
    get_current_manager,
)
from app.modules.tournaments.services.age_split_service import AgeSplitService
from app.modules.tournaments.services.bout_service import BoutService
from app.modules.tournaments.services.bracket_service import BracketService
from app.modules.tournaments.services.group_service import GroupService
from app.modules.tournaments.services.read_service import TournamentReadService
from app.modules.tournaments.services.team_bout_service import TeamBoutService

router = APIRouter(prefix="/api/v1", tags=["tournament-bouts"])


# ------------------------------------------------------------ rule reference


@router.get("/bout-rules", response_model=WeaponRulesView)
async def get_bout_rules() -> WeaponRulesView:
    """The confirmed ruleset as data, so the UI has one source for it."""
    return WeaponRulesView(
        weapons=[
            {"code": code, "label_ru": rules.WEAPON_LABELS_RU[code], "armed": code in rules.ARMED_CATEGORIES}
            for code in rules.WEAPON_CATEGORIES
        ],
        die_sides=rules.DIE_SIDES,
        die_face_to_weapon=rules.DIE_FACE_TO_WEAPON,
        actions=[ScoringActionView(**vars(action)) for action in rules.SCORING_ACTIONS.values()],
        round_target_points=rules.ROUND_TARGET_POINTS,
        max_rounds_per_bout=rules.MAX_ROUNDS_PER_BOUT,
        staging_note_nozh_vs_palka=rules.STAGING_NOTE_NOZH_VS_PALKA,
    )


# ------------------------------------------------------------------ bracket


@router.post("/competitions/{competition_id}/bracket/preview", response_model=BracketPlanView)
async def preview_bracket(
    competition_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> BracketPlanView:
    """Dry run — shows byes and the city verdict without writing anything."""
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    return BracketPlanView(**await BracketService.preview(session, competition_id))


@router.post(
    "/competitions/{competition_id}/bracket/generate",
    response_model=BracketPlanView,
    status_code=status.HTTP_201_CREATED,
)
async def generate_bracket(
    competition_id: str,
    payload: BracketGenerateRequest | None = None,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> BracketPlanView:
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    plan = await BracketService.generate(
        session,
        competition_id,
        actor_id=manager.user.id,
        final_weapon=(payload.final_weapon if payload else None),
    )
    await session.commit()
    return BracketPlanView(**plan)


@router.get("/competitions/{competition_id}/champion", response_model=ChampionSummaryView)
async def get_champion(competition_id: str, session: AsyncSession = Depends(get_db)) -> ChampionSummaryView:
    return ChampionSummaryView(**await BracketService.champion_summary(session, competition_id))


# --------------------------------------------------------------- withdrawal


@router.post("/participants/{participant_id}/withdraw", response_model=WithdrawalView)
async def withdraw_participant(
    participant_id: str,
    payload: ParticipantWithdrawRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> WithdrawalView:
    """Take a fighter out and award their unfought bouts to their opponents.

    Not the same thing as ``POST /participant-status-history``, which only
    records a status: that route leaves the bracket holding a fighter who will
    never appear, and the bout stuck forever. This one settles the bouts too.
    """
    participant = await TournamentReadService.get_participant(session, participant_id)
    await ensure_can_manage_participant(session, manager, participant)
    result = await BracketService.withdraw_participant(
        session,
        participant_id,
        reason=payload.reason,
        to_status=payload.status,
        actor_id=manager.user.id,
    )
    await session.commit()
    return WithdrawalView(**result)


# ---------------------------------------------------------------- bout view


@router.get("/matches/{match_id}/bout", response_model=BoutDetailView)
async def get_bout(match_id: str, session: AsyncSession = Depends(get_db)) -> BoutDetailView:
    return BoutDetailView(**await BoutService.bout_detail(session, match_id))


# ---------------------------------------------------------------------- lot


@router.post("/matches/{match_id}/lot", response_model=LotView, status_code=status.HTTP_201_CREATED)
async def draw_lot(
    match_id: str,
    payload: LotDrawRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> LotView:
    """Draw one side's weapon.

    ONLINE_DICE is rolled on the server with `secrets` and persisted before the
    response is written, so the browser receives an already-fixed result it
    cannot influence. A second draw on the same side is a 409; a draw on a final
    is a 400 — both refused here, not merely hidden in the UI.
    """
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    lot = await BoutService.draw_lot(
        session,
        match_id,
        side=payload.side,
        method=payload.method,
        die_value=payload.die_value,
        actor_id=manager.user.id,
    )
    await session.commit()
    return LotView(
        id=str(lot.id),
        side=lot.side,
        method=lot.method,
        die_value=lot.die_value,
        weapon=lot.weapon,
        sequence=lot.sequence,
        created_at=lot.created_at,
    )


@router.post("/matches/{match_id}/lot/override", response_model=LotView, status_code=status.HTTP_201_CREATED)
async def override_lot(
    match_id: str,
    payload: LotOverrideRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> LotView:
    """Correct a drawn lot. The superseded draw is kept and journalled."""
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    lot = await BoutService.override_lot(
        session,
        match_id,
        side=payload.side,
        method=payload.method,
        die_value=payload.die_value,
        reason=payload.reason,
        actor_id=manager.user.id,
    )
    await session.commit()
    return LotView(
        id=str(lot.id),
        side=lot.side,
        method=lot.method,
        die_value=lot.die_value,
        weapon=lot.weapon,
        sequence=lot.sequence,
        created_at=lot.created_at,
    )


# ---------------------------------------------------------------- lifecycle


@router.post("/matches/{match_id}/start", response_model=MatchView)
async def start_bout(
    match_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> MatchView:
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    await BoutService.start_bout(session, match_id, actor_id=manager.user.id)
    await session.commit()
    return await TournamentReadService.match_detail(session, match_id)


@router.post("/matches/{match_id}/rounds", response_model=MatchRoundView, status_code=status.HTTP_201_CREATED)
async def open_round(
    match_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> MatchRoundView:
    """Open the next соступ."""
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    await BoutService.open_round(session, match_id, actor_id=manager.user.id)
    await session.commit()
    return (await _round_views(session, match_id))[-1]


@router.post("/matches/{match_id}/rounds/{round_number}/score", response_model=BoutDetailView)
async def record_score(
    match_id: str,
    round_number: int,
    payload: RoundScoreRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> BoutDetailView:
    """Credit one scoring action and let the rules do the rest.

    Reaching three points, an accentuated three-pointer or a disarm close the
    соступ — and a disarm by the unarmed fighter closes the whole поединок — all
    inside this one call, so the UI never decides an outcome.
    """
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    await BoutService.record_score(
        session,
        match_id,
        round_number,
        participant_id=payload.participant_id,
        action_code=payload.action_code,
        actor_id=manager.user.id,
    )
    await session.commit()
    return BoutDetailView(**await BoutService.bout_detail(session, match_id))


@router.post("/matches/{match_id}/rounds/{round_number}/complete", response_model=BoutDetailView)
async def complete_round(
    match_id: str,
    round_number: int,
    payload: RoundCompleteRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> BoutDetailView:
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    await BoutService.complete_round(
        session,
        match_id,
        round_number,
        winner_participant_id=payload.winner_participant_id,
        end_reason=payload.end_reason,
        notes=payload.notes,
        actor_id=manager.user.id,
    )
    await session.commit()
    return BoutDetailView(**await BoutService.bout_detail(session, match_id))


async def _round_views(session: AsyncSession, match_id: str) -> list[MatchRoundView]:
    detail = await BoutService.bout_detail(session, match_id)
    return [MatchRoundView(**item) for item in detail["rounds"]]


# ------------------------------------------------------------- team bouts 3x3


@router.post(
    "/competitions/{competition_id}/team-bouts/generate",
    response_model=list[TeamBoutView],
    status_code=status.HTTP_201_CREATED,
)
async def generate_team_bouts(
    competition_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> list[TeamBoutView]:
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    await TeamBoutService.generate_round_robin(session, competition_id, actor_id=manager.user.id)
    await session.commit()
    return [TeamBoutView(**item) for item in await TeamBoutService.list_bouts(session, competition_id)]


@router.get("/competitions/{competition_id}/team-bouts", response_model=list[TeamBoutView])
async def list_team_bouts(competition_id: str, session: AsyncSession = Depends(get_db)) -> list[TeamBoutView]:
    return [TeamBoutView(**item) for item in await TeamBoutService.list_bouts(session, competition_id)]


@router.post("/matches/{match_id}/team-result", response_model=MatchView, status_code=status.HTTP_201_CREATED)
async def record_team_pairing_result(
    match_id: str,
    payload: TeamPairingResultRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> MatchView:
    """Record a 3x3 pairing: a pin plus a signalled finishing blow."""
    match = await BoutService.get_match(session, match_id)
    await ensure_can_manage_match(session, manager, match)
    await TeamBoutService.record_pairing_result(
        session,
        match_id,
        winner_participant_id=payload.winner_participant_id,
        notes=payload.notes,
        actor_id=manager.user.id,
    )
    await session.commit()
    return await TournamentReadService.match_detail(session, match_id)


# -------------------------------------------------------------- group stage


@router.post("/competitions/{competition_id}/groups/suggest", response_model=GroupLayoutSuggestionView)
async def suggest_groups(
    competition_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> GroupLayoutSuggestionView:
    """Every valid way to split this field, with one marked as advice.

    POST rather than GET only for consistency with the bracket preview beside
    it, which is also a manager-guarded dry run.
    """
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    return GroupLayoutSuggestionView(**await GroupService.suggest(session, competition_id))


@router.post("/competitions/{competition_id}/groups/preview", response_model=GroupPlanView)
async def preview_groups(
    competition_id: str,
    payload: GroupStageConfigRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> GroupPlanView:
    """Dry run of the deal — who lands where, and what could not be separated."""
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    plan = await GroupService.preview(
        session,
        competition_id,
        group_count=payload.group_count,
        advance_per_group=payload.advance_per_group,
    )
    return GroupPlanView(**plan)


@router.post(
    "/competitions/{competition_id}/groups/generate",
    response_model=GroupPlanView,
    status_code=status.HTTP_201_CREATED,
)
async def generate_groups(
    competition_id: str,
    payload: GroupStageConfigRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> GroupPlanView:
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    plan = await GroupService.generate(
        session,
        competition_id,
        group_count=payload.group_count,
        advance_per_group=payload.advance_per_group,
        actor_id=manager.user.id,
    )
    await session.commit()
    return GroupPlanView(**plan)


@router.post("/competition-groups/{group_id}/tie-break", response_model=GroupStageView)
async def resolve_group_tie(
    group_id: str,
    payload: GroupTieBreakRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> GroupStageView:
    """Settle a tie the bouts could not.

    The platform refuses to pick a place it did not determine, so this is where
    a человек does it — with a reason, on the record.
    """
    group = await GroupService.get_group(session, group_id)
    competition = await TournamentReadService.get_competition(session, str(group.competition_id))
    await ensure_can_manage_competition(session, manager, competition)
    standings = await GroupService.resolve_tie(
        session,
        group_id,
        ordering=payload.ordering,
        reason=payload.reason,
        actor_id=manager.user.id,
    )
    await session.commit()
    return GroupStageView(**standings)


@router.post(
    "/competitions/{competition_id}/playoff/generate",
    response_model=BracketPlanView,
    status_code=status.HTTP_201_CREATED,
)
async def generate_playoff(
    competition_id: str,
    payload: BracketGenerateRequest | None = None,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> BracketPlanView:
    """Build the knockout stage from the group winners."""
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    plan = await GroupService.promote_to_playoff(
        session,
        competition_id,
        actor_id=manager.user.id,
        final_weapon=(payload.final_weapon if payload else None),
    )
    await session.commit()
    return BracketPlanView(**plan)


# --------------------------------------------------------------- age streams


@router.get("/competitions/{competition_id}/age-split", response_model=AgeSplitView)
async def preview_age_split(
    competition_id: str, session: AsyncSession = Depends(get_db)
) -> AgeSplitView:
    """The age streams this discipline would be cut into. Writes nothing.

    Public, like the other read projections: which children fight whom is not
    a secret, and the page showing it is the same one everybody reads.
    """
    return AgeSplitView(**await AgeSplitService.preview(session, competition_id))


@router.post(
    "/competitions/{competition_id}/age-split",
    response_model=AgeSplitResultView,
    status_code=status.HTTP_201_CREATED,
)
async def apply_age_split(
    competition_id: str,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> AgeSplitResultView:
    """Turn the streams into disciplines of their own.

    This one keeps its id and becomes the youngest stream; the rest are created
    beside it. Each then runs as an ordinary discipline — own bracket, own
    champion — so nothing downstream has to learn what a stream is.
    """
    competition = await TournamentReadService.get_competition(session, competition_id)
    await ensure_can_manage_competition(session, manager, competition)
    result = await AgeSplitService.apply(session, competition_id, actor_id=manager.user.id)
    await session.commit()
    return AgeSplitResultView(**result)
