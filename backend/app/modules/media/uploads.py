"""Files in, files out.

Separate from `router.py`, which records metadata about files that live
somewhere else entirely. This module is the only place in the backend that
writes bytes to disk.

Uploading needs a login; downloading does not. That asymmetry is deliberate and
the same one the entry-list blank already has: the coach who reads a положение
is usually not the organizer and usually not signed in, while putting a file
into the platform is not something an anonymous caller does.
"""

from __future__ import annotations

import hashlib
from io import BytesIO
from typing import IO
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.core.database import get_db
from app.core.file_format import sniff
from app.core.identity_access import User
from app.core.session_auth import get_current_user
from app.core.storage import Storage, get_storage
from app.modules.media.models.media_file import MediaFile

router = APIRouter(prefix="/api/v1/media", tags=["media-uploads"])


class MediaUploadResponse(BaseModel):
    id: str
    url: str
    original_name: str
    size: int | None
    mime_type: str | None
    duplicate_of: str | None


MAX_UPLOAD_BYTES = 20 * 1024 * 1024

#: What the platform stores, and what each kind is called on the way back out.
ACCEPTED = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

REFUSALS = {
    "pdf": "PDF мы не принимаем — пришлите файл в Word или Excel.",
    "doc": "Старый .doc не поддерживается — пересохраните как «Документ Word (.docx)».",
}


@router.post("/uploads", status_code=201, response_model=MediaUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    content_length: int | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> MediaUploadResponse:
    """Take one document in.

    The format is decided by looking inside the file, never by its name, and
    the refusal names the format it found — «PDF мы не принимаем» sends the
    sender to fix the right thing, «не прочиталось» does not.

    Honest limit of the size check below: Starlette has already spooled the
    whole request body to disk/memory before this function is ever called, so
    reading in chunks does not stop a hostile client from *sending* 20+ MB —
    only ASGI-level limits could do that. What chunking buys is that this
    handler never *holds* more than the ceiling in one `bytes` object, and
    that a client honest enough to declare `Content-Length` gets refused
    before a single chunk is read.
    """
    too_large = HTTPException(
        status_code=413,
        detail=f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ.",
    )
    if content_length is not None and content_length > MAX_UPLOAD_BYTES:
        raise too_large

    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(1024 * 1024):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise too_large
        chunks.append(chunk)
    payload = b"".join(chunks)

    kind = sniff(payload)
    if kind in REFUSALS:
        raise HTTPException(status_code=400, detail=REFUSALS[kind])
    if kind not in ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail="Принимаются только файлы Word (.docx) и Excel (.xlsx).",
        )

    digest = hashlib.sha256(payload).hexdigest()
    existing = await session.scalar(
        select(MediaFile).where(MediaFile.content_sha256 == digest)
    )
    if existing is not None:
        # Same bytes: one stored object, one row, a new link wherever the
        # caller is attaching it. Writing a second copy would leave two rows
        # whose deletion semantics depend on each other.
        return _described(existing, duplicate_of=str(existing.id))

    name = file.filename or f"файл.{kind}"
    key = f"media/{uuid4()}.{kind}"
    storage.put(key, BytesIO(payload))

    stored = MediaFile(
        filename=key.rsplit("/", 1)[-1],
        original_name=name[:255],
        storage_key=key,
        url="/api/v1/media/files/placeholder/download",
        type="DOCUMENT",
        size=len(payload),
        mime_type=ACCEPTED[kind],
        content_sha256=digest,
        uploaded_by=current_user.id,
    )
    session.add(stored)
    await session.flush()
    # The public address needs the id, which only exists after the flush.
    stored.url = f"/api/v1/media/files/{stored.id}/download"
    await session.commit()
    return _described(stored, duplicate_of=None)


def _described(stored: MediaFile, *, duplicate_of: str | None) -> MediaUploadResponse:
    return MediaUploadResponse(
        id=str(stored.id),
        url=stored.url,
        original_name=stored.original_name,
        size=stored.size,
        mime_type=stored.mime_type,
        duplicate_of=duplicate_of,
    )


@router.get("/files/{media_file_id}/download")
async def download_file(
    media_file_id: str,
    session: AsyncSession = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> StreamingResponse:
    """Hand the file back under the name it arrived with.

    A route rather than a static mount: static serving sets no
    `Content-Disposition`, so Word would open as rubbish in the browser instead
    of downloading, and the URL would copy the layout on disk — which would make
    a move to S3 break every stored link. This route can answer with a redirect
    to a signed URL later and no saved address changes.

    Public, like the entry-list blank and for the same reason.
    """
    try:
        # The PostgreSQL UUID column rejects a bare string under some dialects
        # (notably the sqlite test engine), so the path param is parsed by hand
        # rather than trusted to the ORM's type coercion.
        file_uuid = UUID(media_file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Файл не найден.") from None

    stored = await session.get(MediaFile, file_uuid)
    if stored is None:
        raise HTTPException(status_code=404, detail="Файл не найден.")
    try:
        stream = storage.open(stored.storage_key)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Файл числится в базе, но его нет в хранилище.",
        ) from None

    from urllib.parse import quote

    # RFC 5987: the name is Russian more often than not, and a bare
    # `filename=` would arrive mangled or truncated at the first non-ASCII byte.
    # safe="" also percent-encodes "/", so a submitted filename containing one
    # cannot smuggle a path segment into the header value.
    disposition = f"attachment; filename*=UTF-8''{quote(stored.original_name, safe='')}"
    return StreamingResponse(
        _chunks(stream),
        media_type=stored.mime_type or "application/octet-stream",
        headers={"Content-Disposition": disposition, "Content-Length": str(stored.size)},
        # Without this the handle `storage.open` returned is never closed on
        # the success path — the failure path is fine, since the exception
        # fires before any handle exists.
        background=BackgroundTask(stream.close),
    )


def _chunks(handle: IO[bytes], size: int = 64 * 1024):
    """Read fixed-size blocks instead of handing the raw handle to StreamingResponse.

    A binary file object still iterates line-by-line (`b"\\n"` splits it), so a
    compressed .docx with no newlines for tens of megabytes turns into on the
    order of 10^5 single-byte-ish reads — correct output, pathological cost.
    """
    while block := handle.read(size):
        yield block
