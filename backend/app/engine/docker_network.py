"""Transparent localhost → host.docker.internal rewriting for Docker containers.

When running inside Docker, localhost/127.0.0.1 in URLs refers to the container,
not the host machine. This module rewrites those URLs so user-provided localhost
URLs "just work" without manual changes.
"""
from __future__ import annotations

import os
import re

_IN_DOCKER = os.environ.get("WS_DOCKER") == "1"

_LOCALHOST_RE = re.compile(
    r"^(https?://)(?:localhost|127\.0\.0\.1)((?::\d+)?/.*)$",
    re.IGNORECASE,
)


def resolve_url(url: str) -> str:
    """Rewrite localhost URLs to host.docker.internal when running in Docker."""
    if not _IN_DOCKER:
        return url
    m = _LOCALHOST_RE.match(url)
    if m:
        return f"{m.group(1)}host.docker.internal{m.group(2)}"
    return url
