from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.db.repository import run_repository
from app.models.runs import RunRecord
from app.services.junit_export import run_to_junit_xml
from app.services.run_diff import diff_runs
from app.services.run_service import run_service
from app.storage.workflow_store import workflow_store
from app.storage.preset_store import preset_store

router = APIRouter(prefix="/runs", tags=["Runs"])


class StartRunRequest(BaseModel):
    workflow_id: str
    preset_id: str | None = None
    variables: dict[str, str] = {}


class StartRunResponse(BaseModel):
    run_id: str


@router.post("")
async def start_run(req: StartRunRequest) -> StartRunResponse:
    workflow = workflow_store.get(req.workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Merge variables: workflow defaults < preset < request
    variables = dict(workflow.variables)

    if req.preset_id:
        preset = preset_store.get(req.preset_id)
        if preset:
            for p in preset.parameters:
                if p.step_type == "*":
                    variables[p.param_name] = str(p.value)

    variables.update(req.variables)

    run_id = await run_service.start_run(workflow, variables)
    return StartRunResponse(run_id=run_id)


@router.post("/{run_id}/cancel")
async def cancel_run(run_id: str) -> dict[str, bool]:
    cancelled = run_service.cancel_run(run_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Run not found or already completed")
    return {"cancelled": True}


@router.get("")
async def list_runs(
    workflow_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[RunRecord]:
    return await run_repository.list_runs(workflow_id, status, limit, offset)


@router.get("/{run_id}")
async def get_run(run_id: str) -> RunRecord:
    record = await run_repository.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return record


@router.delete("/{run_id}")
async def delete_run(run_id: str) -> dict[str, bool]:
    deleted = await run_repository.delete_run(run_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"deleted": True}


@router.get("/{run_id}/junit.xml")
async def export_junit(run_id: str) -> Response:
    record = await run_repository.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    xml = run_to_junit_xml(record)
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{record.workflow_id}-{run_id[:8]}.xml"'},
    )


@router.get("/{run_id}/diff")
async def get_run_diff(
    run_id: str,
    other: str = Query(..., description="The other run_id to diff against"),
) -> dict[str, Any]:
    a = await run_repository.get_run(run_id)
    b = await run_repository.get_run(other)
    if a is None or b is None:
        raise HTTPException(status_code=404, detail="One or both runs not found")
    return diff_runs(a, b)
