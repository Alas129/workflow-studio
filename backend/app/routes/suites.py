from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.schedules_repo import suite_repository
from app.models.schedules import TestSuite, TestSuiteCreate
from app.services.run_service import run_service
from app.storage.workflow_store import workflow_store

router = APIRouter(prefix="/suites", tags=["Test Suites"])


class SuiteRunRequest(BaseModel):
    variables: dict[str, str] = {}


class SuiteRunResponse(BaseModel):
    suite_id: str
    run_ids: list[str]
    skipped: list[str]


@router.get("")
async def list_suites() -> list[TestSuite]:
    return await suite_repository.list_all()


@router.post("")
async def create_suite(data: TestSuiteCreate) -> TestSuite:
    return await suite_repository.create(data)


@router.get("/{suite_id}")
async def get_suite(suite_id: str) -> TestSuite:
    suite = await suite_repository.get(suite_id)
    if suite is None:
        raise HTTPException(status_code=404, detail="Suite not found")
    return suite


@router.delete("/{suite_id}")
async def delete_suite(suite_id: str) -> dict[str, bool]:
    ok = await suite_repository.delete(suite_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Suite not found")
    return {"deleted": True}


@router.post("/{suite_id}/run")
async def run_suite(suite_id: str, req: SuiteRunRequest) -> SuiteRunResponse:
    suite = await suite_repository.get(suite_id)
    if suite is None:
        raise HTTPException(status_code=404, detail="Suite not found")

    run_ids: list[str] = []
    skipped: list[str] = []
    for wf_id in suite.workflow_ids:
        workflow = workflow_store.get(wf_id)
        if workflow is None:
            skipped.append(wf_id)
            continue
        merged_vars = dict(workflow.variables)
        merged_vars.update(req.variables)
        run_id = await run_service.start_run(workflow, merged_vars)
        run_ids.append(run_id)
    return SuiteRunResponse(suite_id=suite_id, run_ids=run_ids, skipped=skipped)
