from __future__ import annotations

import time
from typing import Any

import httpx

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext
from app.engine.docker_network import resolve_url


@register_step("http_request")
class HttpRequestStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        url = resolve_url(context.resolve_variable(str(params.get("url", ""))))
        method = params.get("method", "POST").upper()
        headers = {}
        for k, v in (params.get("headers") or {}).items():
            headers[k] = context.resolve_variable(str(v))
        body = params.get("body")
        timeout = params.get("timeout_seconds", 180)

        if not url:
            raise StepExecutionError("url is required")

        start = time.time()
        async with httpx.AsyncClient(timeout=timeout) as client:
            if context.cancellation_token.is_cancelled:
                raise StepExecutionError("Cancelled")

            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=body if body else None,
            )
            duration_ms = int((time.time() - start) * 1000)

            try:
                response_body = response.json()
            except Exception:
                response_body = response.text

            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_body,
                "duration_ms": duration_ms,
            }

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors = []
        if not params.get("url"):
            errors.append("url is required")
        return errors
