from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.rules.schemas.judge_certification import JudgeCertificationCreateRequest, JudgeCertificationResponse
from app.modules.rules.schemas.judging_scenario import JudgingScenarioCreateRequest, JudgingScenarioResponse
from app.modules.rules.schemas.rule import RuleCreateRequest, RuleResponse
from app.modules.rules.schemas.rule_section import RuleSectionCreateRequest, RuleSectionResponse
from app.modules.rules.schemas.rule_set import RuleSetCreateRequest, RuleSetResponse
from app.modules.rules.services.rule_service import RuleService

router = APIRouter(prefix="/api/v1", tags=["rules"])


@router.post("/rulesets", response_model=RuleSetResponse, status_code=status.HTTP_201_CREATED)
async def create_rule_set(payload: RuleSetCreateRequest, session: AsyncSession = Depends(get_db)) -> RuleSetResponse:
    rule_set = await RuleService.create_rule_set(
        session,
        title=payload.title,
        description=payload.description,
        version=payload.version,
        status=payload.status,
        published_at=payload.published_at,
    )
    await session.commit()
    return RuleSetResponse(
        id=str(rule_set.id),
        title=rule_set.title,
        description=rule_set.description,
        version=rule_set.version,
        status=rule_set.status,
        published_at=rule_set.published_at,
    )


@router.get("/rulesets", response_model=list[RuleSetResponse])
async def list_rule_sets(session: AsyncSession = Depends(get_db)) -> list[RuleSetResponse]:
    rule_sets = await RuleService.list_rule_sets(session)
    return [
        RuleSetResponse(
            id=str(rule_set.id),
            title=rule_set.title,
            description=rule_set.description,
            version=rule_set.version,
            status=rule_set.status,
            published_at=rule_set.published_at,
        )
        for rule_set in rule_sets
    ]


@router.post("/rulesets/{rule_set_id}/sections", response_model=RuleSectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(rule_set_id: str, payload: RuleSectionCreateRequest, session: AsyncSession = Depends(get_db)) -> RuleSectionResponse:
    section = await RuleService.create_section(
        session,
        rule_set_id=rule_set_id,
        title=payload.title,
        description=payload.description,
        order_number=payload.order_number,
    )
    await session.commit()
    return RuleSectionResponse(
        id=str(section.id),
        rule_set_id=str(section.rule_set_id),
        title=section.title,
        description=section.description,
        order_number=section.order_number,
    )


@router.get("/rulesets/{rule_set_id}/sections", response_model=list[RuleSectionResponse])
async def list_sections(rule_set_id: str, session: AsyncSession = Depends(get_db)) -> list[RuleSectionResponse]:
    sections = await RuleService.list_sections(session, rule_set_id)
    return [
        RuleSectionResponse(
            id=str(section.id),
            rule_set_id=str(section.rule_set_id),
            title=section.title,
            description=section.description,
            order_number=section.order_number,
        )
        for section in sections
    ]


@router.post("/sections/{section_id}/rules", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(section_id: str, payload: RuleCreateRequest, session: AsyncSession = Depends(get_db)) -> RuleResponse:
    rule = await RuleService.create_rule(
        session,
        section_id=section_id,
        title=payload.title,
        content=payload.content,
        rule_type=payload.rule_type,
        order_number=payload.order_number,
    )
    await session.commit()
    return RuleResponse(
        id=str(rule.id),
        section_id=str(rule.section_id),
        title=rule.title,
        content=rule.content,
        rule_type=rule.rule_type,
        order_number=rule.order_number,
    )


@router.get("/sections/{section_id}/rules", response_model=list[RuleResponse])
async def list_rules(section_id: str, session: AsyncSession = Depends(get_db)) -> list[RuleResponse]:
    rules = await RuleService.list_rules(session, section_id)
    return [
        RuleResponse(
            id=str(rule.id),
            section_id=str(rule.section_id),
            title=rule.title,
            content=rule.content,
            rule_type=rule.rule_type,
            order_number=rule.order_number,
        )
        for rule in rules
    ]


@router.post("/judging/scenarios", response_model=JudgingScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_judging_scenario(
    payload: JudgingScenarioCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> JudgingScenarioResponse:
    scenario = await RuleService.create_judging_scenario(
        session,
        title=payload.title,
        description=payload.description,
        video_url=payload.video_url,
        correct_decision=payload.correct_decision,
        judge_comment=payload.judge_comment,
        category=payload.category,
    )
    await session.commit()
    return JudgingScenarioResponse(
        id=str(scenario.id),
        title=scenario.title,
        description=scenario.description,
        video_url=scenario.video_url,
        correct_decision=scenario.correct_decision,
        judge_comment=scenario.judge_comment,
        category=scenario.category,
    )


@router.get("/judging/scenarios", response_model=list[JudgingScenarioResponse])
async def list_judging_scenarios(session: AsyncSession = Depends(get_db)) -> list[JudgingScenarioResponse]:
    scenarios = await RuleService.list_judging_scenarios(session)
    return [
        JudgingScenarioResponse(
            id=str(scenario.id),
            title=scenario.title,
            description=scenario.description,
            video_url=scenario.video_url,
            correct_decision=scenario.correct_decision,
            judge_comment=scenario.judge_comment,
            category=scenario.category,
        )
        for scenario in scenarios
    ]


@router.post("/judging/certifications", response_model=JudgeCertificationResponse, status_code=status.HTTP_201_CREATED)
async def create_judge_certification(
    payload: JudgeCertificationCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> JudgeCertificationResponse:
    certification = await RuleService.create_judge_certification(
        session,
        user_id=payload.user_id,
        level=payload.level,
        status=payload.status,
        expires_at=payload.expires_at,
    )
    await session.commit()
    return JudgeCertificationResponse(
        id=str(certification.id),
        user_id=str(certification.user_id),
        level=certification.level,
        status=certification.status,
        issued_at=certification.issued_at,
        expires_at=certification.expires_at,
    )


@router.get("/judging/certifications", response_model=list[JudgeCertificationResponse])
async def list_judge_certifications(
    user_id: str | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[JudgeCertificationResponse]:
    certifications = await RuleService.list_judge_certifications(session, user_id=user_id)
    return [
        JudgeCertificationResponse(
            id=str(certification.id),
            user_id=str(certification.user_id),
            level=certification.level,
            status=certification.status,
            issued_at=certification.issued_at,
            expires_at=certification.expires_at,
        )
        for certification in certifications
    ]
