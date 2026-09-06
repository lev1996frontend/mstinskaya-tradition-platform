from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.athletes.models import Athlete
from app.modules.identity.models import User


class AthleteService:
    """Athlete profiles, and the one thing they do not store themselves: the
    person's name.

    An ``Athlete`` carries a ``nickname`` — a боевое имя, and an optional one —
    while the actual ФИО lives on the ``User`` the profile belongs to
    (registration requires both halves of it, so it is always there). Reads
    therefore load the user alongside the profile and hand the name out through
    :meth:`full_name_of`; the identity module itself is only read from, never
    written to, and nothing outside this service needs to know where the name
    comes from.

    Without this, the name was simply unavailable to every consumer: the
    organizer's athlete search and the entry-list import could only match a
    fighter by nickname, so anyone entered under their real name failed to link
    to their existing profile — the very duplicate identity ``create_participant``
    exists to prevent.
    """

    #: Reads that hand out a name have to bring the user with them — a lazy load
    #: on ``athlete.user`` inside async SQLAlchemy raises rather than querying.
    _WITH_PERSON = (selectinload(Athlete.user),)

    @staticmethod
    def full_name_of(athlete: Athlete) -> str | None:
        """ФИО as it is written on the person's account, «Фамилия Имя».

        Requires the athlete to have been loaded with :attr:`_WITH_PERSON`.
        """
        user = athlete.user
        if user is None:
            return None
        parts = [part.strip() for part in (user.last_name, user.first_name) if part and part.strip()]
        return " ".join(parts) if parts else None
    @staticmethod
    async def create_athlete(
        session: AsyncSession,
        *,
        user_id: str,
        nickname: str | None,
        birth_year: int | None,
        experience_years: int,
        level: str,
        bio: str | None,
        photo_url: str | None,
    ) -> Athlete:
        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        user = await session.get(User, parsed_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        existing = await session.scalar(select(Athlete).where(Athlete.user_id == parsed_user_id))
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Athlete profile already exists for this user")

        normalized_level = str(level).upper()
        valid_levels = {"BEGINNER", "PRACTITIONER", "INSTRUCTOR", "MASTER"}
        if normalized_level not in valid_levels:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid athlete level")

        athlete = Athlete(
            user_id=parsed_user_id,
            nickname=nickname,
            birth_year=birth_year,
            experience_years=experience_years,
            level=normalized_level,
            bio=bio,
            photo_url=photo_url,
        )
        # The user is already in hand from the check above; handing it to the
        # relationship means the response can read a name off this brand-new
        # profile without a second query — and, more to the point, without an
        # async lazy load, which would raise instead of fetching.
        athlete.user = user
        session.add(athlete)
        await session.flush()
        return athlete

    @staticmethod
    async def get_athlete(session: AsyncSession, athlete_id: str) -> Athlete:
        try:
            athlete_uuid = UUID(str(athlete_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid athlete id") from None

        athlete = await session.get(Athlete, athlete_uuid, options=list(AthleteService._WITH_PERSON))
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")
        return athlete

    @staticmethod
    async def get_by_user_id(session: AsyncSession, user_id: str) -> Athlete:
        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        athlete = await session.scalar(
            select(Athlete).options(*AthleteService._WITH_PERSON).where(Athlete.user_id == parsed_user_id)
        )
        if athlete is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete profile not found")
        return athlete

    @staticmethod
    async def list_athletes(session: AsyncSession) -> list[Athlete]:
        # `selectinload` — one extra query for the whole page of users, not one
        # per athlete.
        result = await session.execute(
            select(Athlete).options(*AthleteService._WITH_PERSON).order_by(Athlete.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_athlete(
        session: AsyncSession,
        athlete_id: str,
        *,
        nickname: str | None = None,
        birth_year: int | None = None,
        experience_years: int | None = None,
        level: str | None = None,
        bio: str | None = None,
        photo_url: str | None = None,
    ) -> Athlete:
        athlete = await AthleteService.get_athlete(session, athlete_id)

        if nickname is not None:
            athlete.nickname = nickname
        if birth_year is not None:
            athlete.birth_year = birth_year
        if experience_years is not None:
            athlete.experience_years = experience_years
        if level is not None:
            normalized_level = str(level).upper()
            valid_levels = {"BEGINNER", "PRACTITIONER", "INSTRUCTOR", "MASTER"}
            if normalized_level not in valid_levels:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid athlete level")
            athlete.level = normalized_level
        if bio is not None:
            athlete.bio = bio
        if photo_url is not None:
            athlete.photo_url = photo_url

        await session.flush()
        return athlete
