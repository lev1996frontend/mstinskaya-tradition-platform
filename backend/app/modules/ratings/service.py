from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.athletes.models import Athlete
from app.modules.ratings.models import Achievement, AthleteCompetition, RatingEvent, RatingProfile
from app.modules.ratings.schemas import (
    AchievementCreate,
    AthleteCompetitionCreate,
    RatingEventCreate,
    RatingProfileCreate,
)


class RatingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_rating_profile_by_athlete(self, athlete_id: UUID) -> RatingProfile | None:
        result = await self.db.execute(
            select(RatingProfile).where(RatingProfile.athlete_id == athlete_id)
        )
        return result.scalar_one_or_none()

    async def get_rating_profile(self, profile_id: UUID) -> RatingProfile | None:
        result = await self.db.execute(select(RatingProfile).where(RatingProfile.id == profile_id))
        return result.scalar_one_or_none()

    async def create_rating_profile(self, payload: RatingProfileCreate) -> RatingProfile:
        athlete = await self.db.get(Athlete, payload.athlete_id)
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")

        existing = await self.get_rating_profile_by_athlete(payload.athlete_id)
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rating profile already exists")

        rating_value = getattr(payload, "rating_points", None)
        if rating_value is None:
            rating_value = payload.rating

        profile = RatingProfile(
            athlete_id=payload.athlete_id,
            rating=float(rating_value),
            wins=getattr(payload, "wins", 0),
            losses=getattr(payload, "losses", 0),
            draws=getattr(payload, "draws", 0),
            tier=getattr(payload, "tier", "unranked"),
            last_calculated_at=datetime.now(timezone.utc),
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def create_achievement(self, payload: AchievementCreate) -> Achievement:
        athlete = await self.db.get(Athlete, payload.athlete_id)
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")

        achievement = Achievement(
            athlete_id=payload.athlete_id,
            title=payload.title,
            description=payload.description,
            award_type=getattr(payload, "type", None) or getattr(payload, "award_type", "achievement"),
            type=getattr(payload, "type", None) or getattr(payload, "award_type", "TITLE"),
            issued_date=getattr(payload, "issued_date", datetime.now(timezone.utc)),
        )
        self.db.add(achievement)
        await self.db.commit()
        await self.db.refresh(achievement)
        return achievement

    async def create_competition_record(self, payload: AthleteCompetitionCreate) -> AthleteCompetition:
        athlete = await self.db.get(Athlete, payload.athlete_id)
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")

        record = AthleteCompetition(
            athlete_id=payload.athlete_id,
            tournament_id=payload.tournament_id,
            category_id=payload.category_id,
            result=payload.result,
            place=payload.place,
            matches_count=payload.matches_count,
            wins_count=payload.wins_count,
            losses_count=payload.losses_count,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def create_rating_event(self, payload: RatingEventCreate) -> RatingEvent:
        athlete = await self.db.get(Athlete, payload.athlete_id)
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")

        event = RatingEvent(
            athlete_id=payload.athlete_id,
            source_type=getattr(payload, "source_type", "tournament"),
            source_id=payload.tournament_id,
            delta=float(getattr(payload, "points", 0)),
            previous_rating=0.0,
            new_rating=float(getattr(payload, "points", 0)),
            reason=getattr(payload, "reason", None),
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def list_rating_events_for_athlete(self, athlete_id: UUID) -> list[RatingEvent]:
        result = await self.db.execute(
            select(RatingEvent).where(RatingEvent.athlete_id == athlete_id).order_by(RatingEvent.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_achievements_for_athlete(self, athlete_id: UUID) -> list[Achievement]:
        result = await self.db.execute(
            select(Achievement).where(Achievement.athlete_id == athlete_id).order_by(Achievement.earned_at.desc())
        )
        return list(result.scalars().all())

    async def list_competitions_for_athlete(self, athlete_id: UUID) -> list[AthleteCompetition]:
        result = await self.db.execute(
            select(AthleteCompetition)
            .where(AthleteCompetition.athlete_id == athlete_id)
            .order_by(AthleteCompetition.created_at.desc())
        )
        return list(result.scalars().all())
