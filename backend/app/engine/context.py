from __future__ import annotations

import asyncio
import re
from typing import Any, Callable, Awaitable

from app.engine.cancellation import CancellationToken


class ExecutionContext:

    def __init__(
        self,
        run_id: str,
        variables: dict[str, str],
        cancellation_token: CancellationToken,
        progress_callback: Callable[[dict[str, Any]], Awaitable[None]],
    ):
        self.run_id = run_id
        self.variables = dict(variables)
        self.cancellation_token = cancellation_token
        self._progress_callback = progress_callback
        self._step_outputs: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def emit_progress(self, step_id: str, data: dict[str, Any]) -> None:
        from datetime import datetime, timezone

        await self._progress_callback({
            "type": "step_progress",
            "run_id": self.run_id,
            "step_id": step_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        })

    async def set_step_outputs(self, step_id: str, outputs: dict[str, Any]) -> None:
        async with self._lock:
            self._step_outputs[step_id] = outputs

    async def get_step_outputs(self, step_id: str) -> dict[str, Any]:
        async with self._lock:
            return self._step_outputs.get(step_id, {})

    async def get_all_outputs_for_step(self, step_id: str) -> list[dict[str, Any]]:
        """Get all matrix-expanded outputs for a step (step_id:0, step_id:1, etc.)."""
        async with self._lock:
            results = []
            prefix = f"{step_id}:"
            for key, val in self._step_outputs.items():
                if key == step_id or key.startswith(prefix):
                    results.append(val)
            return results

    def resolve_variable(self, text: str) -> str:
        def replacer(m: re.Match) -> str:
            key = m.group(1).strip()
            return self.variables.get(key, m.group(0))

        return re.sub(r"\{\{(.+?)\}\}", replacer, text)
