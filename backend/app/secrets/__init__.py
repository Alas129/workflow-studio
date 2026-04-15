"""Secret resolution. Supports ${{ secrets.KEY }} syntax.

Providers (in priority order):
1. FileSecretProvider — user-managed secrets in user_data/secrets.json
2. EnvSecretProvider  — environment variables prefixed with WS_SECRET_
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class SecretProvider(ABC):
    @abstractmethod
    def get(self, key: str) -> str | None:
        ...

    @abstractmethod
    def list_keys(self) -> list[str]:
        ...


class EnvSecretProvider(SecretProvider):
    """Read secrets from env vars prefixed with WS_SECRET_."""

    PREFIX = "WS_SECRET_"

    def get(self, key: str) -> str | None:
        return os.environ.get(f"{self.PREFIX}{key}") or os.environ.get(key)

    def list_keys(self) -> list[str]:
        return sorted(
            k[len(self.PREFIX):]
            for k in os.environ
            if k.startswith(self.PREFIX)
        )


class FileSecretProvider(SecretProvider):
    """Read/write secrets from a JSON file."""

    def __init__(self, path: Path):
        self._path = path

    def _load(self) -> dict[str, str]:
        if not self._path.exists():
            return {}
        with open(self._path) as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}

    def _save(self, data: dict[str, str]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write: temp file → rename
        fd, tmp = tempfile.mkstemp(
            dir=str(self._path.parent), suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(data, f, indent=2, sort_keys=True)
            os.replace(tmp, self._path)
        except Exception:
            os.unlink(tmp)
            raise

    def get(self, key: str) -> str | None:
        return self._load().get(key)

    def list_keys(self) -> list[str]:
        return sorted(self._load().keys())

    def set(self, key: str, value: str) -> None:
        data = self._load()
        data[key] = value
        self._save(data)

    def delete(self, key: str) -> bool:
        data = self._load()
        if key not in data:
            return False
        del data[key]
        self._save(data)
        return True


class CompositeSecretProvider(SecretProvider):
    """Chain multiple providers. First match wins for get()."""

    def __init__(self, providers: list[SecretProvider]):
        self._providers = providers

    def get(self, key: str) -> str | None:
        for p in self._providers:
            val = p.get(key)
            if val is not None:
                return val
        return None

    def list_keys(self) -> list[str]:
        keys: set[str] = set()
        for p in self._providers:
            keys.update(p.list_keys())
        return sorted(keys)


_provider: SecretProvider = EnvSecretProvider()
_file_provider: FileSecretProvider | None = None

_SECRET_PATTERN = re.compile(r"\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}")


def init_provider() -> None:
    """Initialize composite provider with file + env backends."""
    global _provider, _file_provider
    from app.config import settings
    _file_provider = FileSecretProvider(settings.secrets_path)
    _provider = CompositeSecretProvider([_file_provider, EnvSecretProvider()])


def get_secret(key: str) -> str | None:
    return _provider.get(key)


def list_secret_keys() -> list[str]:
    return _provider.list_keys()


def list_secrets_with_source() -> list[dict[str, str]]:
    """Return keys with source info (for the API)."""
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    if _file_provider:
        for k in _file_provider.list_keys():
            result.append({"key": k, "source": "file"})
            seen.add(k)
    env = EnvSecretProvider()
    for k in env.list_keys():
        if k not in seen:
            result.append({"key": k, "source": "env"})
    return sorted(result, key=lambda x: x["key"])


def set_secret(key: str, value: str) -> None:
    """Create or update a secret (file-based only)."""
    if _file_provider is None:
        init_provider()
    assert _file_provider is not None
    _file_provider.set(key, value)


def delete_secret(key: str) -> bool:
    """Delete a file-based secret. Returns False if not found."""
    if _file_provider is None:
        init_provider()
    assert _file_provider is not None
    return _file_provider.delete(key)


def resolve_secrets(value: Any) -> Any:
    """Recursively replace ${{ secrets.KEY }} in strings (and in nested structures)."""
    if isinstance(value, str):
        def repl(m: re.Match) -> str:
            key = m.group(1)
            resolved = _provider.get(key)
            return resolved if resolved is not None else m.group(0)
        return _SECRET_PATTERN.sub(repl, value)
    if isinstance(value, dict):
        return {k: resolve_secrets(v) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve_secrets(v) for v in value]
    return value


def set_provider(provider: SecretProvider) -> None:
    global _provider
    _provider = provider
