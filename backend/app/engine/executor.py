from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

from app.models.workflows import WorkflowDefinition
from app.models.runs import RunRecord, RunStatus, StepRunResult, StepRunStatus
from app.engine.context import ExecutionContext
from app.engine.scheduler import DAGScheduler
from app.engine.cancellation import CancellationToken
from app.engine.matrix import should_fan_out, expand_for_matrix
from app.steps.registry import get_handler


class WorkflowExecutor:

    def __init__(
        self,
        workflow: WorkflowDefinition,
        variables: dict[str, str],
        progress_callback: Callable[[dict[str, Any]], Awaitable[None]],
        max_parallel: int = 10,
    ):
        self.workflow = workflow
        self.run_id = str(uuid.uuid4())
        self.cancellation_token = CancellationToken()
        self.context = ExecutionContext(
            run_id=self.run_id,
            variables=variables,
            cancellation_token=self.cancellation_token,
            progress_callback=progress_callback,
        )
        self.scheduler = DAGScheduler(workflow)
        self._semaphore = asyncio.Semaphore(max_parallel)
        self._completed: set[str] = set()
        self._failed: set[str] = set()
        self._step_results: list[StepRunResult] = []
        self._running: set[str] = set()

    async def run(self) -> RunRecord:
        started = datetime.now(timezone.utc)
        await self.context._progress_callback({
            "type": "run_started",
            "run_id": self.run_id,
            "timestamp": started.isoformat(),
            "data": {"workflow_id": self.workflow.id, "total_steps": len(self.workflow.steps)},
        })

        error_msg = None
        try:
            await self._execute_dag()
            status = RunStatus.FAILED if self._failed else RunStatus.COMPLETED
        except asyncio.CancelledError:
            status = RunStatus.CANCELLED
        except Exception as exc:
            status = RunStatus.FAILED
            error_msg = str(exc)

        finished = datetime.now(timezone.utc)

        # Build summary
        summary = self._build_summary()

        record = RunRecord(
            id=self.run_id,
            workflow_id=self.workflow.id,
            workflow_name=self.workflow.name,
            status=status,
            variables=self.context.variables,
            started_at=started,
            finished_at=finished,
            duration_ms=int((finished - started).total_seconds() * 1000),
            step_results=self._step_results,
            summary=summary,
            error=error_msg,
        )

        msg_type = "run_completed" if status == RunStatus.COMPLETED else "run_failed"
        await self.context._progress_callback({
            "type": msg_type,
            "run_id": self.run_id,
            "timestamp": finished.isoformat(),
            "data": {"status": status.value, "summary": summary},
        })

        return record

    async def _execute_dag(self) -> None:
        while True:
            if self.cancellation_token.is_cancelled:
                raise asyncio.CancelledError()

            ready = self.scheduler.get_ready_steps(self._completed | self._failed)
            # Filter out already-running steps
            ready = [s for s in ready if s.id not in self._running]

            if not ready:
                if self._running:
                    # Wait for running steps to finish
                    await asyncio.sleep(0.1)
                    continue
                break

            tasks = [self._run_step(step) for step in ready]
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _run_step(self, step) -> None:
        self._running.add(step.id)
        try:
            handler = get_handler(step.type)
            input_connections = self.scheduler.get_inputs_for_step(step.id)
            inputs: dict[str, Any] = {}
            for conn in input_connections:
                upstream_out = await self.context.get_step_outputs(conn.source_step_id)
                inputs.update(upstream_out)

            if should_fan_out(inputs):
                matrix = inputs.pop("matrix")
                matrix_results: list[dict[str, Any]] = []
                coros = []
                for idx, row in enumerate(matrix):
                    local_vars = dict(self.context.variables)
                    merged_params = expand_for_matrix(step.params, row, local_vars)
                    coros.append(
                        self._execute_single(
                            step, handler, merged_params, inputs,
                            idx, self._matrix_key(row), local_vars,
                        )
                    )
                results = await asyncio.gather(*coros, return_exceptions=True)

                # Collect all matrix outputs for downstream summarize step
                all_outputs = await self.context.get_all_outputs_for_step(step.id)
                await self.context.set_step_outputs(step.id, {
                    "_matrix_results": all_outputs,
                    "matrix_count": len(matrix),
                })
            else:
                await self._execute_single(step, handler, step.params, inputs, None, None, None)

            if step.id not in self._failed:
                self._completed.add(step.id)
        finally:
            self._running.discard(step.id)

    async def _execute_single(
        self,
        step,
        handler,
        params: dict[str, Any],
        inputs: dict[str, Any],
        matrix_index: int | None,
        matrix_key: str | None,
        local_vars: dict[str, str] | None,
    ) -> None:
        async with self._semaphore:
            started = datetime.now(timezone.utc)

            await self.context._progress_callback({
                "type": "step_started",
                "run_id": self.run_id,
                "step_id": step.id,
                "matrix_index": matrix_index,
                "timestamp": started.isoformat(),
                "data": {"label": step.label, "matrix_key": matrix_key},
            })

            result = StepRunResult(
                step_id=step.id,
                step_type=step.type,
                label=step.label,
                matrix_index=matrix_index,
                matrix_key=matrix_key,
                status=StepRunStatus.RUNNING,
                started_at=started,
            )

            # Use local vars if provided (matrix expansion), otherwise use context vars
            if local_vars:
                original_vars = dict(self.context.variables)
                self.context.variables.update(local_vars)

            try:
                outputs = await handler.execute(params, inputs, self.context)
                result.status = StepRunStatus.COMPLETED
                result.outputs = outputs

                output_key = f"{step.id}:{matrix_index}" if matrix_index is not None else step.id
                await self.context.set_step_outputs(output_key, outputs)

                await self.context._progress_callback({
                    "type": "step_completed",
                    "run_id": self.run_id,
                    "step_id": step.id,
                    "matrix_index": matrix_index,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {"outputs": outputs, "matrix_key": matrix_key},
                })

            except Exception as exc:
                result.status = StepRunStatus.FAILED
                result.error = str(exc)
                self._failed.add(step.id)

                await self.context._progress_callback({
                    "type": "step_failed",
                    "run_id": self.run_id,
                    "step_id": step.id,
                    "matrix_index": matrix_index,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {"error": str(exc), "matrix_key": matrix_key},
                })
            finally:
                if local_vars:
                    self.context.variables = original_vars

                finished = datetime.now(timezone.utc)
                result.finished_at = finished
                result.duration_ms = int((finished - started).total_seconds() * 1000)
                self._step_results.append(result)

    def _build_summary(self) -> dict[str, Any]:
        total = len(self._step_results)
        completed = sum(1 for r in self._step_results if r.status == StepRunStatus.COMPLETED)
        failed = sum(1 for r in self._step_results if r.status == StepRunStatus.FAILED)
        durations = [r.duration_ms for r in self._step_results if r.duration_ms is not None]

        return {
            "total_tasks": total,
            "completed": completed,
            "failed": failed,
            "avg_duration_ms": int(sum(durations) / len(durations)) if durations else 0,
        }

    def _matrix_key(self, row: dict[str, Any]) -> str:
        return "|".join(f"{k}={v}" for k, v in row.items())

    def cancel(self) -> None:
        self.cancellation_token.cancel()
