from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.athletes.schemas.athlete import AthleteCreateRequest, AthleteResponse, AthleteUpdateRequest
from app.modules.athletes.services.athlete_service import AthleteService

router = APIRouter(prefix="/api/v1/athletes", tags=["athletes"])


@router.post("", response_model=AthleteResponse, status_code=status.HTTP_201_CREATED)
async def create_athlete(payload: AthleteCreateRequest, session: AsyncSession = Depends(get_db)) -> AthleteResponse:
    athlete = await AthleteService.create_athlete(
        session,
        user_id=payload.user_id,
        nickname=payload.nickname,
        birth_year=payload.birth_year,
        experience_years=payload.experience_years,
        level=payload.level,
        bio=payload.bio,
        photo_url=payload.photo_url,
    )
    await session.commit()
    return AthleteResponse(
        id=str(athlete.id),
        user_id=str(athlete.user_id),
        nickname=athlete.nickname,
        birth_year=athlete.birth_year,
        experience_years=athlete.experience_years,
        level=athlete.level,
        bio=athlete.bio,
        photo_url=athlete.photo_url,
    )


@router.get("", response_model=list[AthleteResponse])
async def list_athletes(session: AsyncSession = Depends(get_db)) -> list[AthleteResponse]:
    athletes = await AthleteService.list_athletes(session)
    return [
        AthleteResponse(
            id=str(athlete.id),
            user_id=str(athlete.user_id),
            nickname=athlete.nickname,
            birth_year=athlete.birth_year,
            experience_years=athlete.experience_years,
            level=athlete.level,
            bio=athlete.bio,
            photo_url=athlete.photo_url,
        )
        for athlete in athletes
    ]


@router.get("/{athlete_id}", response_model=AthleteResponse)
async def get_athlete(athlete_id: str, session: AsyncSession = Depends(get_db)) -> AthleteResponse:
    athlete = await AthleteService.get_athlete(session, athlete_id)
    return AthleteResponse(
        id=str(athlete.id),
        user_id=str(athlete.user_id),
        nickname=athlete.nickname,
        birth_year=athlete.birth_year,
        experience_years=athlete.experience_years,
        level=athlete.level,
        bio=athlete.bio,
        photo_url=athlete.photo_url,
    )


@router.get("/user/{user_id}", response_model=AthleteResponse)
async def get_athlete_by_user(user_id: str, session: AsyncSession = Depends(get_db)) -> AthleteResponse:
    athlete = await AthleteService.get_by_user_id(session, user_id)
    return AthleteResponse(
        id=str(athlete.id),
        user_id=str(athlete.user_id),
        nickname=athlete.nickname,
        birth_year=athlete.birth_year,
        experience_years=athlete.experience_years,
        level=athlete.level,
        bio=athlete.bio,
        photo_url=athlete.photo_url,
    )


@router.patch("/{athlete_id}", response_model=AthleteResponse)
async def update_athlete(
    athlete_id: str,
    payload: AthleteUpdateRequest,
    session: AsyncSession = Depends(get_db),
) -> AthleteResponse:
    athlete = await AthleteService.update_athlete(
        session,
        athlete_id,
        nickname=payload.nickname,
        birth_year=payload.birth_year,
        experience_years=payload.experience_years,
        level=payload.level,
        bio=payload.bio,
        photo_url=payload.photo_url,
    )
    await session.commit()
    return AthleteResponse(
        id=str(athlete.id),
        user_id=str(athlete.user_id),
        nickname=athlete.nickname,
        birth_year=athlete.birth_year,
        experience_years=athlete.experience_years,
        level=athlete.level,
        bio=athlete.bio,
        photo_url=athlete.photo_url,
    )
