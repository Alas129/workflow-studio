from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket

from app.db.repository import run_repository
from app.engine.executor import WorkflowExecutor
from app.models.runs import RunRecord
from app.models.workflows import WorkflowDefinition


class RunService:
    def __init__(self) -> None:
        self._active_runs: dict[str, WorkflowExecutor] = {}
        self._subscribers: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def start_run(
        self,
        workflow: WorkflowDefinition,
        variables: dict[str, str],
        max_parallel: int = 10,
    ) -> str:
        executor = WorkflowExecutor(
            workflow=workflow,
            variables=variables,
            progress_callback=self._make_callback(None),
            max_parallel=max_parallel,
        )

        run_id = executor.run_id
        self._active_runs[run_id] = executor
        executor.context._progress_callback = self._make_callback(run_id)

        # Run in background
        asyncio.create_task(self._execute_and_store(run_id, executor))

        return run_id

    async def _execute_and_store(self, run_id: str, executor: WorkflowExecutor) -> None:
        try:
            record = await executor.run()
            await run_repository.save_run(record)
        finally:
            self._active_runs.pop(run_id, None)

    def cancel_run(self, run_id: str) -> bool:
        executor = self._active_runs.get(run_id)
        if executor:
            executor.cancel()
            return True
        return False

    def is_running(self, run_id: str) -> bool:
        return run_id in self._active_runs

    async def subscribe(self, run_id: str, ws: WebSocket) -> None:
        async with self._lock:
            if run_id not in self._subscribers:
                self._subscribers[run_id] = []
            self._subscribers[run_id].append(ws)

    async def unsubscribe(self, run_id: str, ws: WebSocket) -> None:
        async with self._lock:
            if run_id in self._subscribers:
                self._subscribers[run_id] = [
                    w for w in self._subscribers[run_id] if w != ws
                ]
                if not self._subscribers[run_id]:
                    del self._subscribers[run_id]

    def _make_callback(self, run_id: str | None):
        async def callback(msg: dict[str, Any]) -> None:
            rid = run_id or msg.get("run_id", "")
            subscribers = self._subscribers.get(rid, [])
            dead: list[WebSocket] = []
            for ws in subscribers:
                try:
                    await ws.send_json(msg)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                await self.unsubscribe(rid, ws)

        return callback


run_service = RunService()
