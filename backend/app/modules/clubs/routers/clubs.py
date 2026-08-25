from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.clubs.schemas.club import ClubCreateRequest, ClubMemberCreateRequest, ClubMemberResponse, ClubResponse
from app.modules.clubs.services.club_service import ClubService

router = APIRouter(prefix="/api/v1/clubs", tags=["clubs"])


@router.post("", response_model=ClubResponse, status_code=status.HTTP_201_CREATED)
async def create_club(payload: ClubCreateRequest, session: AsyncSession = Depends(get_db)) -> ClubResponse:
    club = await ClubService.create_club(
        session,
        name=payload.name,
        description=payload.description,
        country=payload.country,
        city=payload.city,
        website_url=payload.website_url,
        logo_url=payload.logo_url,
    )
    await session.commit()
    return ClubResponse(
        id=str(club.id),
        name=club.name,
        description=club.description,
        country=club.country,
        city=club.city,
        website_url=club.website_url,
        logo_url=club.logo_url,
        is_active=club.is_active,
    )


@router.get("", response_model=list[ClubResponse])
async def list_clubs(session: AsyncSession = Depends(get_db)) -> list[ClubResponse]:
    clubs = await ClubService.list_clubs(session)
    return [
        ClubResponse(
            id=str(club.id),
            name=club.name,
            description=club.description,
            country=club.country,
            city=club.city,
            website_url=club.website_url,
            logo_url=club.logo_url,
            is_active=club.is_active,
        )
        for club in clubs
    ]


@router.post("/{club_id}/members", response_model=ClubMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member_to_club(
    club_id: str,
    payload: ClubMemberCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> ClubMemberResponse:
    member = await ClubService.add_member(
        session,
        club_id=club_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    await session.commit()
    return ClubMemberResponse(
        id=str(member.id),
        club_id=str(member.club_id),
        user_id=str(member.user_id),
        role=member.role,
    )


@router.get("/{club_id}/members", response_model=list[ClubMemberResponse])
async def list_members(club_id: str, session: AsyncSession = Depends(get_db)) -> list[ClubMemberResponse]:
    members = await ClubService.list_members(session, club_id)
    return [
        ClubMemberResponse(
            id=str(member.id),
            club_id=str(member.club_id),
            user_id=str(member.user_id),
            role=member.role,
        )
        for member in members
    ]
