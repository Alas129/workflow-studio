"""Background scheduler. Polls the DB every N seconds for due schedules
and launches the corresponding workflow runs.
"""
from __future__ import annotations

import asyncio
import logging

from app.db.schedules_repo import schedule_repository
from app.services.run_service import run_service
from app.storage.preset_store import preset_store
from app.storage.workflow_store import workflow_store

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None


async def _tick_once() -> int:
    """Check for due schedules and fire them. Returns count fired."""
    due = await schedule_repository.list_due()
    fired = 0
    for schedule in due:
        try:
            workflow = workflow_store.get(schedule.workflow_id)
            if workflow is None:
                logger.warning("Schedule %s references missing workflow %s", schedule.id, schedule.workflow_id)
                await schedule_repository.update_after_fire(schedule.id)
                continue

            variables = dict(workflow.variables)
            if schedule.preset_id:
                preset = preset_store.get(schedule.preset_id)
                if preset:
                    for p in preset.parameters:
                        if p.step_type == "*":
                            variables[p.param_name] = str(p.value)
            variables.update(schedule.variables)

            run_id = await run_service.start_run(workflow, variables)
            logger.info("Schedule %s fired run %s", schedule.id, run_id)
            await schedule_repository.update_after_fire(schedule.id)
            fired += 1
        except Exception:
            logger.exception("Failed to fire schedule %s", schedule.id)
    return fired


async def _loop(poll_seconds: int) -> None:
    assert _stop_event is not None
    while not _stop_event.is_set():
        try:
            await _tick_once()
        except Exception:
            logger.exception("Scheduler tick failed")
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=poll_seconds)
        except asyncio.TimeoutError:
            pass


def start(poll_seconds: int = 10) -> None:
    global _task, _stop_event
    if _task is not None and not _task.done():
        return
    _stop_event = asyncio.Event()
    _task = asyncio.create_task(_loop(poll_seconds), name="workflow-scheduler")


async def stop() -> None:
    global _task, _stop_event
    if _stop_event:
        _stop_event.set()
    if _task:
        try:
            await asyncio.wait_for(_task, timeout=5.0)
        except asyncio.TimeoutError:
            _task.cancel()
        _task = None
    _stop_event = None
