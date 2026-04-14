"""Notification step: send a message to an external channel (generic webhook)."""
from __future__ import annotations

import json
from typing import Any

import httpx

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("notify")
class NotifyStep(BaseStepHandler):
    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        channel = params.get("channel", "webhook")
        webhook_url = context.resolve_variable(str(params.get("webhook_url", "")))
        message = context.resolve_variable(str(params.get("message", "")))
        title = context.resolve_variable(str(params.get("title", "Workflow Notification")))

        if not webhook_url:
            raise StepExecutionError("webhook_url is required")

        if channel == "slack":
            payload: dict[str, Any] = {"text": f"*{title}*\n{message}"}
        elif channel == "discord":
            payload = {"content": f"**{title}**\n{message}"}
        else:
            # Generic webhook: send both fields
            payload = {"title": title, "message": message, "run_id": context.run_id}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code >= 400:
                raise StepExecutionError(f"Notification failed: HTTP {resp.status_code} — {resp.text[:200]}")

        return {
            "channel": channel,
            "status_code": resp.status_code,
            "delivered": True,
        }
