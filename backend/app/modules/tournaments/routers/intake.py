"""Entry lists as a spreadsheet: template out, file in, rows committed.

Its own router because this is the only place in the backend that touches
``UploadFile`` and ``StreamingResponse``, and the only consumer of openpyxl —
keeping that in one file makes the blast radius visible.

The template is public and the two import routes are not. Reading the blank
form is something any coach filling in a club's entry needs to do; putting
people into a roster is the organizer's job alone.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.tournaments.schemas.intake import (
    ImportCommitRequest,
    ImportCommitResponse,
    ImportReport,
)
from app.modules.tournaments.security.deps import (
    TournamentManager,
    ensure_can_manage_tournament,
    get_current_manager,
)
from app.modules.tournaments.services.participant_import import (
    MAX_UPLOAD_BYTES,
    ParticipantImportService,
    parse_workbook,
)
from app.modules.tournaments.services.read_service import TournamentReadService

router = APIRouter(prefix="/api/v1", tags=["tournament-intake"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/tournaments/{tournament_id}/participants/template.xlsx")
async def download_template(
    tournament_id: str,
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """The .xlsx an entry list is filled into.

    Generated from the same column definition the parser reads, so the file
    handed out and the file expected back cannot drift apart.

    Public, unlike the two routes below. In practice a club's coach fills this
    in and sends it to the organizer — and a coach is not the organizer, and
    usually is not signed in at all. It discloses nothing that is not already
    public either: the second sheet holds the tournament's discipline names and
    age bounds, which ``GET /tournaments/{id}/competitions`` already serves to
    anyone. Reading the file is open; putting anyone in the roster is not.
    """
    tournament = await TournamentReadService.get_tournament(session, tournament_id)
    stream = await ParticipantImportService.template(session, tournament)
    return StreamingResponse(
        stream,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="participants-template.xlsx"'},
    )


@router.post("/tournaments/{tournament_id}/participants/import/preview", response_model=ImportReport)
async def preview_import(
    tournament_id: str,
    file: UploadFile = File(...),
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> ImportReport:
    """Read the file and report every problem, writing nothing.

    Deliberately not a commit: the organizer sees the whole verdict, fixes what
    is wrong, and decides. There is no ``session.commit()`` on this path at all.
    """
    tournament = await TournamentReadService.get_tournament(session, tournament_id)
    await ensure_can_manage_tournament(session, manager, tournament)

    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ — это не заявка одного турнира.",
        )

    from io import BytesIO

    rows = parse_workbook(BytesIO(payload))
    report = await ParticipantImportService.validate(
        session, tournament, [{"row_number": row.row_number, **row.values} for row in rows]
    )
    return ImportReport(**report)


@router.post(
    "/tournaments/{tournament_id}/participants/import/commit",
    response_model=ImportCommitResponse,
)
async def commit_import(
    tournament_id: str,
    payload: ImportCommitRequest,
    manager: TournamentManager = Depends(get_current_manager),
    session: AsyncSession = Depends(get_db),
) -> ImportCommitResponse:
    """Enter the reviewed rows.

    Takes rows rather than the file again, because the organizer may have
    corrected a discipline or a birth year in the review table — re-parsing
    would discard those edits. The server therefore re-runs the identical
    validator over what arrives, and refuses the whole batch if anything is
    wrong: a half-imported entry list is worse than a rejected one.
    """
    tournament = await TournamentReadService.get_tournament(session, tournament_id)
    await ensure_can_manage_tournament(session, manager, tournament)
    result = await ParticipantImportService.commit(
        session,
        tournament,
        [row.model_dump() for row in payload.rows],
        actor_id=manager.user.id,
    )
    await session.commit()
    return ImportCommitResponse(**result)
