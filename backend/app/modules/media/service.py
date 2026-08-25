from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.media.models.content_access import ContentAccess
from app.modules.media.models.document import Document
from app.modules.media.models.media_file import MediaFile
from app.modules.media.models.video import Video


class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_media_file(self, *, payload: dict) -> MediaFile:
        media_file = MediaFile(**payload)
        self.db.add(media_file)
        await self.db.commit()
        await self.db.refresh(media_file)
        return media_file

    async def get_media_file(self, media_file_id: UUID) -> MediaFile | None:
        result = await self.db.execute(select(MediaFile).where(MediaFile.id == media_file_id))
        return result.scalar_one_or_none()

    async def list_media_files(self) -> list[MediaFile]:
        result = await self.db.execute(select(MediaFile).order_by(MediaFile.created_at.desc()))
        return list(result.scalars().all())

    async def create_video(self, *, payload: dict) -> Video:
        video = Video(**payload)
        self.db.add(video)
        await self.db.commit()
        await self.db.refresh(video)
        return video

    async def create_document(self, *, payload: dict) -> Document:
        document = Document(**payload)
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        return document

    async def create_access_entry(self, *, payload: dict) -> ContentAccess:
        access_entry = ContentAccess(**payload)
        self.db.add(access_entry)
        await self.db.commit()
        await self.db.refresh(access_entry)
        return access_entry

    async def get_document(self, document_id: UUID) -> Document | None:
        result = await self.db.execute(select(Document).where(Document.id == document_id))
        return result.scalar_one_or_none()

    async def get_video(self, video_id: UUID) -> Video | None:
        result = await self.db.execute(select(Video).where(Video.id == video_id))
        return result.scalar_one_or_none()
