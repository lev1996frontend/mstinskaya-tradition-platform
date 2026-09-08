"""Where the bytes live.

Two methods, one implementation. The interface exists so the day this moves to
S3 is a day that touches this file and nothing else — `docs/architecture.md`
names object storage as the destination, and the only reason it is a local
directory today is that there is one instance and no cloud bill.

There is no `delete`. Files are never erased in this platform: removing a
document means marking the link removed, and the bytes stay because something
may still cite them. A method that does not exist cannot be called by mistake.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import BinaryIO, Protocol

from app.core.config import get_settings


class Storage(Protocol):
    def put(self, key: str, data: BinaryIO) -> None: ...

    def open(self, key: str) -> BinaryIO: ...


class LocalDiskStorage:
    """Files under one root directory.

    Synchronous on purpose: a 20 MB write finishes faster than the hop to a
    thread pool costs, and `aiofiles` would buy nothing. A network-backed
    implementation would make the interface async, and that is one edit here.
    """

    def __init__(self, root: Path | str) -> None:
        self._root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        # Keys are minted by us, but treating them as untrusted costs one line
        # and removes a whole class of "how did that file get written there".
        candidate = (self._root / key).resolve()
        if not candidate.is_relative_to(self._root):
            raise ValueError(f"storage key escapes the root: {key!r}")
        return candidate

    def put(self, key: str, data: BinaryIO) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as target:
            while chunk := data.read(1024 * 1024):
                target.write(chunk)

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")


@lru_cache
def get_storage() -> Storage:
    """The one storage the app writes to, resolved from settings."""
    return LocalDiskStorage(get_settings().upload_dir)
