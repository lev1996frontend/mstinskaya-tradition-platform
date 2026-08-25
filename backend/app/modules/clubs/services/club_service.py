from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clubs.models import Club, ClubMember
from app.modules.identity.models import User


class ClubService:
    @staticmethod
    async def create_club(
        session: AsyncSession,
        *,
        name: str,
        description: str | None,
        country: str | None,
        city: str | None,
        website_url: str | None,
        logo_url: str | None,
    ) -> Club:
        club = Club(
            name=name,
            description=description,
            country=country,
            city=city,
            website_url=website_url,
            logo_url=logo_url,
            is_active=True,
        )
        session.add(club)
        await session.flush()
        return club

    @staticmethod
    async def get_club(session: AsyncSession, club_id: str) -> Club:
        try:
            club_uuid = UUID(str(club_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid club id") from None

        club = await session.get(Club, club_uuid)
        if club is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")
        return club

    @staticmethod
    async def list_clubs(session: AsyncSession) -> list[Club]:
        result = await session.execute(select(Club).order_by(Club.name.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def add_member(session: AsyncSession, *, club_id: str, user_id: str, role: str) -> ClubMember:
        club = await ClubService.get_club(session, club_id)

        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        valid_roles = {"OWNER", "INSTRUCTOR", "MEMBER", "JUDGE"}
        normalized_role = str(role).upper()
        if normalized_role not in valid_roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

        user = await session.get(User, parsed_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        existing = await session.execute(
            select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == parsed_user_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this club")

        member = ClubMember(club_id=club.id, user_id=parsed_user_id, role=normalized_role)
        session.add(member)
        await session.flush()
        return member

    @staticmethod
    async def list_members(session: AsyncSession, club_id: str) -> list[ClubMember]:
        club = await ClubService.get_club(session, club_id)
        result = await session.execute(
            select(ClubMember).where(ClubMember.club_id == club.id).order_by(ClubMember.joined_at.asc())
        )
        return list(result.scalars().all())
