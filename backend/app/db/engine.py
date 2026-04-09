from __future__ import annotations

import aiosqlite

from app.config import settings

_DB_PATH: str | None = None


def _get_db_path() -> str:
    global _DB_PATH
    if _DB_PATH is None:
        db_path = settings.db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _DB_PATH = str(db_path)
    return _DB_PATH


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(_get_db_path())
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db() -> None:
    db = await get_db()
    try:
        await db.executescript(_DDL)
        await db.commit()
    finally:
        await db.close()


_DDL = """
CREATE TABLE IF NOT EXISTS runs (
    id              TEXT PRIMARY KEY,
    workflow_id     TEXT NOT NULL,
    workflow_name   TEXT NOT NULL,
    status          TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
    preset_id       TEXT,
    variables_json  TEXT NOT NULL DEFAULT '{}',
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    duration_ms     INTEGER,
    summary_json    TEXT NOT NULL DEFAULT '{}',
    error           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_workflow_id ON runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);

CREATE TABLE IF NOT EXISTS step_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    step_id         TEXT NOT NULL,
    step_type       TEXT NOT NULL,
    label           TEXT NOT NULL,
    matrix_index    INTEGER,
    matrix_key      TEXT,
    status          TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','skipped','cancelled')),
    started_at      TEXT,
    finished_at     TEXT,
    duration_ms     INTEGER,
    inputs_json     TEXT NOT NULL DEFAULT '{}',
    outputs_json    TEXT NOT NULL DEFAULT '{}',
    error           TEXT,
    logs_json       TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_step_results_run_id ON step_results(run_id);
CREATE INDEX IF NOT EXISTS idx_step_results_step_id ON step_results(step_id);
"""
