from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .steps import StepInstance


class Connection(BaseModel):
    source_step_id: str
    source_output: str = "default"
    target_step_id: str
    target_input: str = "default"
    condition: str | None = None


class WorkflowDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    version: int = 1
    tags: list[str] = []
    variables: dict[str, str] = {}
    steps: list[StepInstance] = []
    connections: list[Connection] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None
