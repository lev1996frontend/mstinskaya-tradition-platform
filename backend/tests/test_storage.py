"""Байты кладутся на диск и читаются обратно — на настоящем диске.

Заглушка здесь бесполезна: проверять надо именно то, что файл появился и
прочёлся, а это ровно то, чего заглушка не делает.
"""

from io import BytesIO

import pytest

from app.core.storage import LocalDiskStorage


def test_bytes_written_are_the_bytes_read_back(tmp_path):
    storage = LocalDiskStorage(tmp_path)
    storage.put("media/abc.docx", BytesIO(b"hello \xd0\xbc\xd1\x81\xd1\x82\xd0\xb0"))

    with storage.open("media/abc.docx") as stream:
        assert stream.read() == b"hello \xd0\xbc\xd1\x81\xd1\x82\xd0\xb0"


def test_a_key_cannot_escape_the_root(tmp_path):
    """«../» в ключе — это попытка писать мимо хранилища, а не ключ."""
    storage = LocalDiskStorage(tmp_path)
    with pytest.raises(ValueError):
        storage.put("../outside.docx", BytesIO(b"x"))
    with pytest.raises(ValueError):
        storage.open("../../etc/passwd")


def test_reading_a_missing_key_says_so(tmp_path):
    storage = LocalDiskStorage(tmp_path)
    with pytest.raises(FileNotFoundError):
        storage.open("media/nothing.docx")
