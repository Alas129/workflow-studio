from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

from app.models.workflows import WorkflowDefinition
from app.models.runs import RunRecord, RunStatus, StepRunResult, StepRunStatus, TestStatus
from app.engine.context import ExecutionContext
from app.engine.scheduler import DAGScheduler
from app.engine.cancellation import CancellationToken
from app.engine.matrix import should_fan_out, expand_for_matrix
from app.steps.registry import get_handler
from app.steps.base import StepExecutionError
from app.secrets import resolve_secrets


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

            # Resolve ${{ secrets.X }} everywhere in params
            resolved_params = resolve_secrets(params)

            try:
                outputs, attempts = await self._run_with_retry(
                    step, handler, resolved_params, inputs
                )
                result.status = StepRunStatus.COMPLETED
                result.outputs = outputs
                result.attempts = attempts
                result.test_status = self._derive_test_status(outputs)

                output_key = f"{step.id}:{matrix_index}" if matrix_index is not None else step.id
                await self.context.set_step_outputs(output_key, outputs)

                await self.context._progress_callback({
                    "type": "step_completed",
                    "run_id": self.run_id,
                    "step_id": step.id,
                    "matrix_index": matrix_index,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {
                        "outputs": outputs,
                        "matrix_key": matrix_key,
                        "test_status": result.test_status.value,
                        "attempts": attempts,
                    },
                })

            except Exception as exc:
                result.status = StepRunStatus.FAILED
                result.error = str(exc)
                result.test_status = TestStatus.FAIL if self._is_assertion_step(step.type) else TestStatus.NA
                if not getattr(step, "continue_on_error", False):
                    self._failed.add(step.id)

                await self.context._progress_callback({
                    "type": "step_failed",
                    "run_id": self.run_id,
                    "step_id": step.id,
                    "matrix_index": matrix_index,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {
                        "error": str(exc),
                        "matrix_key": matrix_key,
                        "test_status": result.test_status.value,
                    },
                })
            finally:
                if local_vars:
                    self.context.variables = original_vars

                finished = datetime.now(timezone.utc)
                result.finished_at = finished
                result.duration_ms = int((finished - started).total_seconds() * 1000)
                self._step_results.append(result)

    async def _run_with_retry(
        self,
        step,
        handler,
        params: dict[str, Any],
        inputs: dict[str, Any],
    ) -> tuple[dict[str, Any], int]:
        """Execute handler with optional retry + mock support. Returns (outputs, attempts)."""
        # Mock short-circuit
        mock = getattr(step, "mock", None)
        if mock and mock.enabled:
            if mock.delay_ms:
                await asyncio.sleep(mock.delay_ms / 1000)
            return dict(mock.outputs), 1

        retry = getattr(step, "retry", None)
        max_attempts = retry.max_attempts if retry else 1
        backoff = retry.backoff_seconds if retry else 1.0
        multiplier = retry.backoff_multiplier if retry else 2.0
        retry_statuses = set(retry.retry_on_status) if retry else set()

        last_exc: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            if self.cancellation_token.is_cancelled:
                raise asyncio.CancelledError()
            try:
                outputs = await handler.execute(params, inputs, self.context)
                # status-based retry (e.g., retry on 5xx)
                status_code = outputs.get("status_code") if isinstance(outputs, dict) else None
                if (
                    status_code in retry_statuses
                    and attempt < max_attempts
                ):
                    await asyncio.sleep(backoff * (multiplier ** (attempt - 1)))
                    continue
                return outputs, attempt
            except StepExecutionError as exc:
                last_exc = exc
                # Don't retry assertion failures — they're deterministic
                if self._is_assertion_step(step.type):
                    raise
                if attempt < max_attempts:
                    await asyncio.sleep(backoff * (multiplier ** (attempt - 1)))
                    continue
                raise
            except Exception as exc:
                last_exc = exc
                if attempt < max_attempts:
                    await asyncio.sleep(backoff * (multiplier ** (attempt - 1)))
                    continue
                raise

        if last_exc:
            raise last_exc
        raise StepExecutionError("Retry logic exhausted unexpectedly")

    @staticmethod
    def _is_assertion_step(step_type: str) -> bool:
        return step_type.startswith("assert_") or step_type == "snapshot"

    @staticmethod
    def _derive_test_status(outputs: dict[str, Any]) -> TestStatus:
        """Map an outputs['test_status'] string to TestStatus enum."""
        if not isinstance(outputs, dict):
            return TestStatus.NA
        val = outputs.get("test_status")
        if val == "pass":
            return TestStatus.PASS
        if val == "fail":
            return TestStatus.FAIL
        return TestStatus.NA

    def _build_summary(self) -> dict[str, Any]:
        total = len(self._step_results)
        completed = sum(1 for r in self._step_results if r.status == StepRunStatus.COMPLETED)
        failed = sum(1 for r in self._step_results if r.status == StepRunStatus.FAILED)
        durations = [r.duration_ms for r in self._step_results if r.duration_ms is not None]
        # Test-oriented metrics
        assertions = [r for r in self._step_results if r.test_status != TestStatus.NA]
        passed = sum(1 for r in assertions if r.test_status == TestStatus.PASS)
        asserts_failed = sum(1 for r in assertions if r.test_status == TestStatus.FAIL)

        return {
            "total_tasks": total,
            "completed": completed,
            "failed": failed,
            "avg_duration_ms": int(sum(durations) / len(durations)) if durations else 0,
            "assertions_total": len(assertions),
            "assertions_passed": passed,
            "assertions_failed": asserts_failed,
        }

    def _matrix_key(self, row: dict[str, Any]) -> str:
        return "|".join(f"{k}={v}" for k, v in row.items())

    def cancel(self) -> None:
        self.cancellation_token.cancel()
