from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from app.db.engine import get_db
from app.models.schedules import Schedule, ScheduleCreate, TestSuite, TestSuiteCreate


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ScheduleRepository:

    async def create(self, data: ScheduleCreate) -> Schedule:
        sid = str(uuid.uuid4())
        next_run = _now() + timedelta(seconds=data.interval_seconds)
        db = await get_db()
        try:
            await db.execute(
                """INSERT INTO schedules (id, workflow_id, name, interval_seconds,
                   variables_json, preset_id, enabled, next_run_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    sid,
                    data.workflow_id,
                    data.name,
                    data.interval_seconds,
                    json.dumps(data.variables),
                    data.preset_id,
                    1 if data.enabled else 0,
                    next_run.isoformat(),
                ),
            )
            await db.commit()
        finally:
            await db.close()
        return await self.get(sid)  # type: ignore[return-value]

    async def get(self, schedule_id: str) -> Schedule | None:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
            row = await cursor.fetchone()
            if row is None:
                return None
            return self._row_to_model(row)
        finally:
            await db.close()

    async def list_all(self) -> list[Schedule]:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM schedules ORDER BY created_at DESC")
            rows = await cursor.fetchall()
            return [self._row_to_model(r) for r in rows]
        finally:
            await db.close()

    async def list_due(self, now: datetime | None = None) -> list[Schedule]:
        now = now or _now()
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ?",
                (now.isoformat(),),
            )
            rows = await cursor.fetchall()
            return [self._row_to_model(r) for r in rows]
        finally:
            await db.close()

    async def update_after_fire(self, schedule_id: str) -> None:
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT interval_seconds FROM schedules WHERE id = ?", (schedule_id,)
            )
            row = await cursor.fetchone()
            if row is None:
                return
            now = _now()
            next_run = now + timedelta(seconds=row["interval_seconds"])
            await db.execute(
                "UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
                (now.isoformat(), next_run.isoformat(), schedule_id),
            )
            await db.commit()
        finally:
            await db.close()

    async def delete(self, schedule_id: str) -> bool:
        db = await get_db()
        try:
            cursor = await db.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()

    async def set_enabled(self, schedule_id: str, enabled: bool) -> bool:
        db = await get_db()
        try:
            cursor = await db.execute(
                "UPDATE schedules SET enabled = ? WHERE id = ?",
                (1 if enabled else 0, schedule_id),
            )
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()

    def _row_to_model(self, row) -> Schedule:
        return Schedule(
            id=row["id"],
            workflow_id=row["workflow_id"],
            name=row["name"],
            interval_seconds=row["interval_seconds"],
            variables=json.loads(row["variables_json"]),
            preset_id=row["preset_id"],
            enabled=bool(row["enabled"]),
            last_run_at=datetime.fromisoformat(row["last_run_at"]) if row["last_run_at"] else None,
            next_run_at=datetime.fromisoformat(row["next_run_at"]) if row["next_run_at"] else None,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
        )


class SuiteRepository:

    async def create(self, data: TestSuiteCreate) -> TestSuite:
        sid = data.id or str(uuid.uuid4())
        db = await get_db()
        try:
            await db.execute(
                """INSERT INTO suites (id, name, description, workflow_ids_json)
                   VALUES (?, ?, ?, ?)""",
                (sid, data.name, data.description, json.dumps(data.workflow_ids)),
            )
            await db.commit()
        finally:
            await db.close()
        return await self.get(sid)  # type: ignore[return-value]

    async def get(self, suite_id: str) -> TestSuite | None:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM suites WHERE id = ?", (suite_id,))
            row = await cursor.fetchone()
            if row is None:
                return None
            return TestSuite(
                id=row["id"],
                name=row["name"],
                description=row["description"] or "",
                workflow_ids=json.loads(row["workflow_ids_json"]),
                created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            )
        finally:
            await db.close()

    async def list_all(self) -> list[TestSuite]:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM suites ORDER BY created_at DESC")
            rows = await cursor.fetchall()
            return [
                TestSuite(
                    id=r["id"],
                    name=r["name"],
                    description=r["description"] or "",
                    workflow_ids=json.loads(r["workflow_ids_json"]),
                    created_at=datetime.fromisoformat(r["created_at"]) if r["created_at"] else None,
                )
                for r in rows
            ]
        finally:
            await db.close()

    async def delete(self, suite_id: str) -> bool:
        db = await get_db()
        try:
            cursor = await db.execute("DELETE FROM suites WHERE id = ?", (suite_id,))
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()


schedule_repository = ScheduleRepository()
suite_repository = SuiteRepository()
