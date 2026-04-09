from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


class YamlStore:
    """Generic YAML file-based storage."""

    def __init__(self, directory: Path):
        self._dir = directory
        self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, id_: str) -> Path:
        return self._dir / f"{id_}.yaml"

    def list_ids(self) -> list[str]:
        return sorted(p.stem for p in self._dir.glob("*.yaml"))

    def exists(self, id_: str) -> bool:
        return self._path(id_).exists()

    def load(self, id_: str) -> dict[str, Any] | None:
        path = self._path(id_)
        if not path.exists():
            return None
        with open(path) as f:
            return yaml.safe_load(f)

    def load_all(self) -> list[dict[str, Any]]:
        results = []
        for id_ in self.list_ids():
            data = self.load(id_)
            if data:
                results.append(data)
        return results

    def save(self, id_: str, data: dict[str, Any]) -> None:
        path = self._path(id_)
        with open(path, "w") as f:
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    def delete(self, id_: str) -> bool:
        path = self._path(id_)
        if path.exists():
            path.unlink()
            return True
        return False
