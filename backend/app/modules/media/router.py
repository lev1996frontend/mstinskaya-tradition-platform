from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.media.schemas.content_access import ContentAccessCreate, ContentAccessRead
from app.modules.media.schemas.document import DocumentCreate, DocumentRead
from app.modules.media.schemas.media_file import MediaFileCreate, MediaFileRead
from app.modules.media.schemas.video import VideoCreate, VideoRead
from app.modules.media.service import MediaService

router = APIRouter(prefix="/api/v1/media", tags=["media"])


async def get_media_service(db: Annotated[AsyncSession, Depends(get_db)]) -> MediaService:
    return MediaService(db)


@router.post("/files", response_model=MediaFileRead, status_code=status.HTTP_201_CREATED)
async def create_media_file(
    payload: MediaFileCreate,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    return await service.create_media_file(payload=payload.model_dump())


@router.get("/files", response_model=list[MediaFileRead])
async def list_media_files(service: Annotated[MediaService, Depends(get_media_service)]):
    return await service.list_media_files()


@router.get("/files/{media_file_id}", response_model=MediaFileRead)
async def get_media_file(
    media_file_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    media_file = await service.get_media_file(media_file_id)
    if not media_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")
    return media_file


@router.post("/videos", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def create_video(
    payload: VideoCreate,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    return await service.create_video(payload=payload.model_dump())


@router.get("/videos/{video_id}", response_model=VideoRead)
async def get_video(
    video_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    video = await service.get_video(video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return video


@router.post("/documents", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    return await service.create_document(payload=payload.model_dump())


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    document = await service.get_document(document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.post("/access", response_model=ContentAccessRead, status_code=status.HTTP_201_CREATED)
async def create_access_entry(
    payload: ContentAccessCreate,
    service: Annotated[MediaService, Depends(get_media_service)],
):
    return await service.create_access_entry(payload=payload.model_dump())
