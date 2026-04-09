from __future__ import annotations

import json
from datetime import datetime

from app.db.engine import get_db
from app.models.runs import RunRecord, RunStatus, StepRunResult, StepRunStatus


class RunRepository:

    async def save_run(self, record: RunRecord) -> None:
        db = await get_db()
        try:
            await db.execute(
                """INSERT INTO runs (id, workflow_id, workflow_name, status, preset_id,
                   variables_json, started_at, finished_at, duration_ms, summary_json, error)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    record.id,
                    record.workflow_id,
                    record.workflow_name,
                    record.status.value,
                    record.preset_id,
                    json.dumps(record.variables),
                    record.started_at.isoformat(),
                    record.finished_at.isoformat() if record.finished_at else None,
                    record.duration_ms,
                    json.dumps(record.summary),
                    record.error,
                ),
            )
            for sr in record.step_results:
                await db.execute(
                    """INSERT INTO step_results (run_id, step_id, step_type, label,
                       matrix_index, matrix_key, status, started_at, finished_at,
                       duration_ms, inputs_json, outputs_json, error, logs_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        record.id,
                        sr.step_id,
                        sr.step_type,
                        sr.label,
                        sr.matrix_index,
                        sr.matrix_key,
                        sr.status.value,
                        sr.started_at.isoformat() if sr.started_at else None,
                        sr.finished_at.isoformat() if sr.finished_at else None,
                        sr.duration_ms,
                        json.dumps(sr.inputs),
                        json.dumps(sr.outputs),
                        sr.error,
                        json.dumps(sr.logs),
                    ),
                )
            await db.commit()
        finally:
            await db.close()

    async def get_run(self, run_id: str) -> RunRecord | None:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
            row = await cursor.fetchone()
            if row is None:
                return None

            cursor2 = await db.execute(
                "SELECT * FROM step_results WHERE run_id = ? ORDER BY id", (run_id,)
            )
            step_rows = await cursor2.fetchall()

            return self._row_to_record(row, step_rows)
        finally:
            await db.close()

    async def list_runs(
        self,
        workflow_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[RunRecord]:
        db = await get_db()
        try:
            conditions: list[str] = []
            params: list[str | int] = []

            if workflow_id:
                conditions.append("workflow_id = ?")
                params.append(workflow_id)
            if status:
                conditions.append("status = ?")
                params.append(status)

            where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            query = f"SELECT * FROM runs {where} ORDER BY started_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()

            records = []
            for row in rows:
                cursor2 = await db.execute(
                    "SELECT * FROM step_results WHERE run_id = ? ORDER BY id",
                    (row["id"],),
                )
                step_rows = await cursor2.fetchall()
                records.append(self._row_to_record(row, step_rows))

            return records
        finally:
            await db.close()

    async def delete_run(self, run_id: str) -> bool:
        db = await get_db()
        try:
            cursor = await db.execute("DELETE FROM runs WHERE id = ?", (run_id,))
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()

    def _row_to_record(self, row, step_rows) -> RunRecord:
        step_results = []
        for sr in step_rows:
            step_results.append(
                StepRunResult(
                    step_id=sr["step_id"],
                    step_type=sr["step_type"],
                    label=sr["label"],
                    matrix_index=sr["matrix_index"],
                    matrix_key=sr["matrix_key"],
                    status=StepRunStatus(sr["status"]),
                    started_at=datetime.fromisoformat(sr["started_at"]) if sr["started_at"] else None,
                    finished_at=datetime.fromisoformat(sr["finished_at"]) if sr["finished_at"] else None,
                    duration_ms=sr["duration_ms"],
                    inputs=json.loads(sr["inputs_json"]),
                    outputs=json.loads(sr["outputs_json"]),
                    error=sr["error"],
                    logs=json.loads(sr["logs_json"]),
                )
            )

        return RunRecord(
            id=row["id"],
            workflow_id=row["workflow_id"],
            workflow_name=row["workflow_name"],
            status=RunStatus(row["status"]),
            preset_id=row["preset_id"],
            variables=json.loads(row["variables_json"]),
            started_at=datetime.fromisoformat(row["started_at"]),
            finished_at=datetime.fromisoformat(row["finished_at"]) if row["finished_at"] else None,
            duration_ms=row["duration_ms"],
            step_results=step_results,
            summary=json.loads(row["summary_json"]),
            error=row["error"],
        )


run_repository = RunRepository()
