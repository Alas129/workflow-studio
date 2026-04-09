from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepRunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class StepRunResult(BaseModel):
    step_id: str
    step_type: str
    label: str
    matrix_index: int | None = None
    matrix_key: str | None = None
    status: StepRunStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    inputs: dict[str, Any] = {}
    outputs: dict[str, Any] = {}
    error: str | None = None
    logs: list[str] = []


class RunRecord(BaseModel):
    id: str
    workflow_id: str
    workflow_name: str
    status: RunStatus
    preset_id: str | None = None
    variables: dict[str, str] = {}
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None
    step_results: list[StepRunResult] = []
    summary: dict[str, Any] = {}
    error: str | None = None
