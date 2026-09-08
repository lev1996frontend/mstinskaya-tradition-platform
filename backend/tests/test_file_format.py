"""Опознание формата по содержимому, а не по имени файла.

Имя врёт: тренер переименовывает документ в .xlsx, почтовый клиент режет
расширение, Word сохраняет .doc под именем .docx. Внутрь файла заглянуть
дешевле, чем разбираться потом.
"""

from io import BytesIO

from docx import Document
from openpyxl import Workbook

from app.core.file_format import sniff


def xlsx_bytes() -> bytes:
    stream = BytesIO()
    Workbook().save(stream)
    return stream.getvalue()


def docx_bytes() -> bytes:
    stream = BytesIO()
    Document().save(stream)
    return stream.getvalue()


def test_a_spreadsheet_is_recognised_whatever_it_is_called():
    assert sniff(xlsx_bytes()) == "xlsx"


def test_a_word_document_is_recognised_whatever_it_is_called():
    assert sniff(docx_bytes()) == "docx"


def test_a_pdf_is_recognised_so_the_refusal_can_name_it():
    """PDF никуда не принимается, но «не прочиталось» — плохой ответ."""
    assert sniff(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n") == "pdf"


def test_the_old_binary_word_format_is_recognised_too():
    assert sniff(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1 old word") == "doc"


def test_anything_else_is_unknown():
    assert sniff(b"just some text") is None
    assert sniff(b"") is None
