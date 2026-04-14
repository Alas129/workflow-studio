from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class Schedule(BaseModel):
    id: str
    workflow_id: str
    name: str
    interval_seconds: int
    variables: dict[str, str] = {}
    preset_id: str | None = None
    enabled: bool = True
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    created_at: datetime | None = None


class ScheduleCreate(BaseModel):
    workflow_id: str
    name: str
    interval_seconds: int
    variables: dict[str, str] = {}
    preset_id: str | None = None
    enabled: bool = True


class TestSuite(BaseModel):
    id: str
    name: str
    description: str = ""
    workflow_ids: list[str] = []
    created_at: datetime | None = None


class TestSuiteCreate(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    workflow_ids: list[str] = []
