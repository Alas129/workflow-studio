from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class WsMessage(BaseModel):
    type: Literal[
        "run_started",
        "step_started",
        "step_progress",
        "step_completed",
        "step_failed",
        "run_completed",
        "run_failed",
        "run_cancelled",
        "log",
    ]
    run_id: str
    step_id: str | None = None
    matrix_index: int | None = None
    timestamp: str
    data: dict[str, Any] = {}
