from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db.schedules_repo import schedule_repository
from app.models.schedules import Schedule, ScheduleCreate
from app.scheduling.scheduler import _tick_once

router = APIRouter(prefix="/schedules", tags=["Schedules"])


@router.get("")
async def list_schedules() -> list[Schedule]:
    return await schedule_repository.list_all()


@router.post("")
async def create_schedule(data: ScheduleCreate) -> Schedule:
    return await schedule_repository.create(data)


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: str) -> Schedule:
    schedule = await schedule_repository.get(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.post("/{schedule_id}/enable")
async def enable_schedule(schedule_id: str) -> dict[str, bool]:
    ok = await schedule_repository.set_enabled(schedule_id, True)
    if not ok:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"enabled": True}


@router.post("/{schedule_id}/disable")
async def disable_schedule(schedule_id: str) -> dict[str, bool]:
    ok = await schedule_repository.set_enabled(schedule_id, False)
    if not ok:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"enabled": False}


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str) -> dict[str, bool]:
    ok = await schedule_repository.delete(schedule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": True}


@router.post("/tick")
async def tick_now() -> dict[str, int]:
    """Force an immediate scheduler tick (useful for tests/demos)."""
    fired = await _tick_once()
    return {"fired": fired}
