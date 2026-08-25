from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.ratings.schemas import (
    AchievementCreate,
    AchievementRead,
    AthleteCompetitionCreate,
    AthleteCompetitionRead,
    RatingEventCreate,
    RatingEventRead,
    RatingProfileCreate,
    RatingProfileRead,
)
from app.modules.ratings.service import RatingsService

router = APIRouter(prefix="/api/v1/ratings", tags=["ratings"])


async def get_ratings_service(db: Annotated[AsyncSession, Depends(get_db)]) -> RatingsService:
    return RatingsService(db)


@router.get("/profiles/{profile_id}", response_model=RatingProfileRead)
async def get_rating_profile(
    profile_id: UUID,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    profile = await service.get_rating_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rating profile not found")
    return profile


@router.get("/athletes/{athlete_id}/profile", response_model=RatingProfileRead)
async def get_rating_profile_by_athlete(
    athlete_id: UUID,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    profile = await service.get_rating_profile_by_athlete(athlete_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rating profile not found")
    return profile


@router.post("/profiles", response_model=RatingProfileRead, status_code=status.HTTP_201_CREATED)
async def create_rating_profile(
    payload: RatingProfileCreate,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.create_rating_profile(payload)


@router.get("/athletes/{athlete_id}/achievements", response_model=list[AchievementRead])
async def list_achievements_for_athlete(
    athlete_id: UUID,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.list_achievements_for_athlete(athlete_id)


@router.post("/achievements", response_model=AchievementRead, status_code=status.HTTP_201_CREATED)
async def create_achievement(
    payload: AchievementCreate,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.create_achievement(payload)


@router.get("/athletes/{athlete_id}/competitions", response_model=list[AthleteCompetitionRead])
async def list_competitions_for_athlete(
    athlete_id: UUID,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.list_competitions_for_athlete(athlete_id)


@router.post("/competitions", response_model=AthleteCompetitionRead, status_code=status.HTTP_201_CREATED)
async def create_competition_record(
    payload: AthleteCompetitionCreate,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.create_competition_record(payload)


@router.post("/events", response_model=RatingEventRead, status_code=status.HTTP_201_CREATED)
async def create_rating_event(
    payload: RatingEventCreate,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.create_rating_event(payload)


@router.get("/athletes/{athlete_id}/events", response_model=list[RatingEventRead])
async def list_rating_events_for_athlete(
    athlete_id: UUID,
    service: Annotated[RatingsService, Depends(get_ratings_service)],
):
    return await service.list_rating_events_for_athlete(athlete_id)
