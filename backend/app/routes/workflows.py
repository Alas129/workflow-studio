from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.workflows import WorkflowDefinition
from app.storage.workflow_store import workflow_store

router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.get("")
def list_workflows() -> list[WorkflowDefinition]:
    return workflow_store.list_all()


@router.get("/{workflow_id}")
def get_workflow(workflow_id: str) -> WorkflowDefinition:
    wf = workflow_store.get(workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.post("")
def create_workflow(workflow: WorkflowDefinition) -> WorkflowDefinition:
    if workflow_store.exists(workflow.id):
        raise HTTPException(status_code=409, detail="Workflow already exists")
    return workflow_store.save(workflow)


@router.put("/{workflow_id}")
def update_workflow(workflow_id: str, workflow: WorkflowDefinition) -> WorkflowDefinition:
    workflow.id = workflow_id
    return workflow_store.save(workflow)


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: str) -> dict[str, bool]:
    deleted = workflow_store.delete(workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"deleted": True}
