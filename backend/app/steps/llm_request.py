from __future__ import annotations

import json
import time
from typing import Any

import httpx

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("llm_request")
class LlmRequestStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        endpoint_url = context.resolve_variable(str(params.get("endpoint_url", "")))
        model = context.resolve_variable(str(params.get("model", "")))
        api_key = context.resolve_variable(str(params.get("api_key", "")))
        auth_type = params.get("auth_type", "x-api-key")
        anthropic_version = params.get("anthropic_version", "bedrock-2023-05-31")
        anthropic_beta = params.get("anthropic_beta")
        messages = params.get("messages", [])
        max_tokens = params.get("max_tokens", 256)
        temperature = params.get("temperature")
        stream = params.get("stream", False)
        thinking_enabled = params.get("thinking_enabled", False)
        thinking_budget_tokens = params.get("thinking_budget_tokens", 10000)
        timeout = params.get("timeout_seconds", 180)

        if not endpoint_url:
            raise StepExecutionError("endpoint_url is required")
        if not model:
            raise StepExecutionError("model is required")

        # Build headers
        headers: dict[str, str] = {"Content-Type": "application/json"}

        if auth_type == "bearer":
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
        else:
            if api_key:
                headers["x-api-key"] = api_key

        if anthropic_version:
            headers["anthropic-version"] = anthropic_version

        if anthropic_beta:
            if isinstance(anthropic_beta, list):
                headers["anthropic-beta"] = ",".join(anthropic_beta)
            else:
                headers["anthropic-beta"] = str(anthropic_beta)

        # Build payload
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        if temperature is not None:
            payload["temperature"] = temperature

        if stream:
            payload["stream"] = True

        if thinking_enabled:
            payload["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget_tokens,
            }

        start = time.time()
        async with httpx.AsyncClient(timeout=timeout) as client:
            if context.cancellation_token.is_cancelled:
                raise StepExecutionError("Cancelled")

            if stream:
                return await self._execute_stream(
                    client, endpoint_url, headers, payload, context, start
                )
            else:
                response = await client.post(
                    endpoint_url, headers=headers, json=payload
                )
                duration_ms = int((time.time() - start) * 1000)

                try:
                    response_body = response.json()
                except Exception:
                    response_body = response.text

                result: dict[str, Any] = {
                    "status_code": response.status_code,
                    "response_body": response_body,
                    "duration_ms": duration_ms,
                    "model_used": model,
                    "endpoint": endpoint_url,
                }

                # Extract token usage if available
                if isinstance(response_body, dict):
                    usage = response_body.get("usage", {})
                    result["input_tokens"] = usage.get("input_tokens")
                    result["output_tokens"] = usage.get("output_tokens")
                    result["stop_reason"] = response_body.get("stop_reason")

                return result

    async def _execute_stream(
        self,
        client: httpx.AsyncClient,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        context: ExecutionContext,
        start: float,
    ) -> dict[str, Any]:
        chunks: list[str] = []
        status_code = 0

        async with client.stream("POST", url, headers=headers, json=payload) as response:
            status_code = response.status_code
            async for line in response.aiter_lines():
                if context.cancellation_token.is_cancelled:
                    raise StepExecutionError("Cancelled")
                if line.startswith("data: "):
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    chunks.append(data)
                    try:
                        parsed = json.loads(data)
                        await context.emit_progress(
                            step_id="",
                            data={"type": "stream_chunk", "chunk": parsed},
                        )
                    except json.JSONDecodeError:
                        pass

        duration_ms = int((time.time() - start) * 1000)

        return {
            "status_code": status_code,
            "response_body": chunks,
            "duration_ms": duration_ms,
            "model_used": payload.get("model"),
            "endpoint": url,
            "stream_chunks": len(chunks),
        }

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors = []
        if not params.get("endpoint_url"):
            errors.append("endpoint_url is required")
        if not params.get("model"):
            errors.append("model is required")
        return errors
