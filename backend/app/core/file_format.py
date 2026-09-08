"""What a file actually is, decided by looking inside it.

The one thing all three file seams share. Intake asks it to pick a parser,
storage asks it to accept or refuse an upload, and both ask for the same
reason: a file name is a claim by whoever sent the file, and it is wrong often
enough to matter — a renamed document, a mail client that dropped the
extension, a Word file saved under the other Word extension.

PDF is recognized even though nothing in the platform accepts it. Knowing it is
a PDF is what lets the refusal say «PDF мы не принимаем, пришлите Word»
instead of «файл не прочитался», which sends the sender to fix the wrong thing.
"""

from __future__ import annotations

import zipfile
from io import BytesIO

#: Both modern Office formats are zip archives; what is inside says which.
EXCEL_MEMBER = "xl/workbook.xml"
WORD_MEMBER = "word/document.xml"

PDF_MAGIC = b"%PDF-"
#: The OLE compound-file header the pre-2007 Office formats start with.
OLE_MAGIC = b"\xd0\xcf\x11\xe0"


def sniff(payload: bytes) -> str | None:
    """``"xlsx"``, ``"docx"``, ``"pdf"``, ``"doc"`` — or ``None`` if unknown."""
    if not payload:
        return None
    if payload.startswith(PDF_MAGIC):
        return "pdf"
    if payload.startswith(OLE_MAGIC):
        return "doc"
    try:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            names = set(archive.namelist())
    except zipfile.BadZipFile:
        return None
    if WORD_MEMBER in names:
        return "docx"
    if EXCEL_MEMBER in names:
        return "xlsx"
    return None
