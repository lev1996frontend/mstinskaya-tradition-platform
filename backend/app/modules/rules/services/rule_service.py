from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import User
from app.modules.rules.models import JudgeCertification, JudgingScenario, Rule, RuleSection, RuleSet


class RuleService:
    @staticmethod
    async def create_rule_set(
        session: AsyncSession,
        *,
        title: str,
        description: str | None,
        version: str,
        status: str,
        published_at: datetime | None,
    ) -> RuleSet:
        normalized_status = str(status).upper()
        valid_statuses = {"DRAFT", "ACTIVE", "ARCHIVED"}
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ruleset status")

        rule_set = RuleSet(
            title=title,
            description=description,
            version=version,
            status=normalized_status,
            published_at=published_at,
        )
        session.add(rule_set)
        await session.flush()
        return rule_set

    @staticmethod
    async def get_rule_set(session: AsyncSession, rule_set_id: str) -> RuleSet:
        try:
            parsed_id = UUID(str(rule_set_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule set id") from None

        rule_set = await session.get(RuleSet, parsed_id)
        if rule_set is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")
        return rule_set

    @staticmethod
    async def list_rule_sets(session: AsyncSession) -> list[RuleSet]:
        result = await session.execute(select(RuleSet).order_by(RuleSet.created_at.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def create_section(session: AsyncSession, *, rule_set_id: str, title: str, description: str | None, order_number: int) -> RuleSection:
        rule_set = await RuleService.get_rule_set(session, rule_set_id)

        section = RuleSection(
            rule_set_id=rule_set.id,
            title=title,
            description=description,
            order_number=order_number,
        )
        session.add(section)
        await session.flush()
        return section

    @staticmethod
    async def get_section(session: AsyncSession, section_id: str) -> RuleSection:
        try:
            parsed_id = UUID(str(section_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule section id") from None

        section = await session.get(RuleSection, parsed_id)
        if section is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule section not found")
        return section

    @staticmethod
    async def list_sections(session: AsyncSession, rule_set_id: str) -> list[RuleSection]:
        rule_set = await RuleService.get_rule_set(session, rule_set_id)
        result = await session.execute(
            select(RuleSection).where(RuleSection.rule_set_id == rule_set.id).order_by(RuleSection.order_number.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_rule(
        session: AsyncSession,
        *,
        section_id: str,
        title: str,
        content: str,
        rule_type: str,
        order_number: int,
    ) -> Rule:
        section = await RuleService.get_section(session, section_id)

        normalized_rule_type = str(rule_type).upper()
        valid_types = {"GENERAL", "SAFETY", "COMBAT", "JUDGING", "VIOLATION"}
        if normalized_rule_type not in valid_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule type")

        rule = Rule(
            section_id=section.id,
            title=title,
            content=content,
            rule_type=normalized_rule_type,
            order_number=order_number,
        )
        session.add(rule)
        await session.flush()
        return rule

    @staticmethod
    async def get_rule(session: AsyncSession, rule_id: str) -> Rule:
        try:
            parsed_id = UUID(str(rule_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule id") from None

        rule = await session.get(Rule, parsed_id)
        if rule is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
        return rule

    @staticmethod
    async def list_rules(session: AsyncSession, section_id: str) -> list[Rule]:
        section = await RuleService.get_section(session, section_id)
        result = await session.execute(
            select(Rule).where(Rule.section_id == section.id).order_by(Rule.order_number.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_judging_scenario(
        session: AsyncSession,
        *,
        title: str,
        description: str | None,
        video_url: str | None,
        correct_decision: str,
        judge_comment: str | None,
        category: str,
    ) -> JudgingScenario:
        normalized_category = str(category).upper()
        valid_categories = {"STRIKE", "WEAPON", "VIOLATION", "SAFETY"}
        if normalized_category not in valid_categories:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid scenario category")

        scenario = JudgingScenario(
            title=title,
            description=description,
            video_url=video_url,
            correct_decision=correct_decision,
            judge_comment=judge_comment,
            category=normalized_category,
        )
        session.add(scenario)
        await session.flush()
        return scenario

    @staticmethod
    async def get_judging_scenario(session: AsyncSession, scenario_id: str) -> JudgingScenario:
        try:
            parsed_id = UUID(str(scenario_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid judging scenario id") from None

        scenario = await session.get(JudgingScenario, parsed_id)
        if scenario is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Judging scenario not found")
        return scenario

    @staticmethod
    async def list_judging_scenarios(session: AsyncSession) -> list[JudgingScenario]:
        result = await session.execute(select(JudgingScenario).order_by(JudgingScenario.created_at.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def create_judge_certification(
        session: AsyncSession,
        *,
        user_id: str,
        level: str,
        status: str,
        expires_at: datetime | None,
    ) -> JudgeCertification:
        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        user = await session.get(User, parsed_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        normalized_level = str(level).upper()
        valid_levels = {"LOCAL", "REGIONAL", "MAIN"}
        if normalized_level not in valid_levels:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid judge level")

        normalized_status = str(status).upper()
        valid_statuses = {"ACTIVE", "EXPIRED", "REVOKED"}
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid certification status")

        certification = JudgeCertification(
            user_id=parsed_user_id,
            level=normalized_level,
            status=normalized_status,
            expires_at=expires_at,
            issued_at=datetime.now(timezone.utc),
        )
        session.add(certification)
        await session.flush()
        return certification

    @staticmethod
    async def get_judge_certification(session: AsyncSession, certification_id: str) -> JudgeCertification:
        try:
            parsed_id = UUID(str(certification_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid judge certification id") from None

        certification = await session.get(JudgeCertification, parsed_id)
        if certification is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Judge certification not found")
        return certification

    @staticmethod
    async def list_judge_certifications(session: AsyncSession, user_id: str | None = None) -> list[JudgeCertification]:
        query = select(JudgeCertification)
        if user_id is not None:
            try:
                parsed_user_id = UUID(str(user_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None
            query = query.where(JudgeCertification.user_id == parsed_user_id)
        result = await session.execute(query.order_by(JudgeCertification.issued_at.asc()))
        return list(result.scalars().all())
