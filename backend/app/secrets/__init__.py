"""Secret resolution. Supports ${{ secrets.KEY }} syntax.

Default backend: environment variables (prefix WS_SECRET_).
Pluggable: add more providers by extending SecretProvider.
"""
from __future__ import annotations

import os
import re
from abc import ABC, abstractmethod
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


_provider: SecretProvider = EnvSecretProvider()

_SECRET_PATTERN = re.compile(r"\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}")


def get_secret(key: str) -> str | None:
    return _provider.get(key)


def list_secret_keys() -> list[str]:
    return _provider.list_keys()


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
