from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.services.run_service import run_service
from app.storage.workflow_store import workflow_store

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


class WebhookPayload(BaseModel):
    variables: dict[str, str] = {}


class WebhookResponse(BaseModel):
    run_id: str


def _verify_token(provided: str | None) -> None:
    expected = os.environ.get("WS_WEBHOOK_TOKEN")
    if expected and provided != expected:
        raise HTTPException(status_code=401, detail="Invalid webhook token")


@router.post("/workflows/{workflow_id}")
async def trigger_workflow(
    workflow_id: str,
    payload: WebhookPayload,
    x_webhook_token: str | None = Header(default=None),
) -> WebhookResponse:
    """Trigger a workflow run from an external system.

    If WS_WEBHOOK_TOKEN env var is set, requests must include X-Webhook-Token header.
    """
    _verify_token(x_webhook_token)

    workflow = workflow_store.get(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    variables = dict(workflow.variables)
    variables.update(payload.variables)

    run_id = await run_service.start_run(workflow, variables)
    return WebhookResponse(run_id=run_id)
