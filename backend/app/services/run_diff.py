"""Diff two RunRecord instances step-by-step, for regression analysis."""
from __future__ import annotations

from typing import Any

from app.models.runs import RunRecord


def _step_key(step_id: str, matrix_index: int | None) -> str:
    return f"{step_id}:{matrix_index}" if matrix_index is not None else step_id


def _diff_dict(a: dict[str, Any], b: dict[str, Any], prefix: str = "") -> list[dict[str, Any]]:
    diffs: list[dict[str, Any]] = []
    all_keys = set(a.keys()) | set(b.keys())
    for k in sorted(all_keys):
        path = f"{prefix}.{k}" if prefix else k
        if k not in a:
            diffs.append({"path": path, "type": "added", "new": b[k]})
        elif k not in b:
            diffs.append({"path": path, "type": "removed", "old": a[k]})
        elif isinstance(a[k], dict) and isinstance(b[k], dict):
            diffs.extend(_diff_dict(a[k], b[k], path))
        elif a[k] != b[k]:
            diffs.append({"path": path, "type": "changed", "old": a[k], "new": b[k]})
    return diffs


def diff_runs(a: RunRecord, b: RunRecord) -> dict[str, Any]:
    """Returns a summary + per-step diff list.

    Compares step_results by (step_id, matrix_index).
    """
    a_steps = {_step_key(s.step_id, s.matrix_index): s for s in a.step_results}
    b_steps = {_step_key(s.step_id, s.matrix_index): s for s in b.step_results}

    only_in_a = sorted(set(a_steps) - set(b_steps))
    only_in_b = sorted(set(b_steps) - set(a_steps))
    common = sorted(set(a_steps) & set(b_steps))

    step_diffs: list[dict[str, Any]] = []
    status_changed = 0

    for key in common:
        sa = a_steps[key]
        sb = b_steps[key]
        entry: dict[str, Any] = {
            "step_key": key,
            "step_id": sa.step_id,
            "label": sa.label,
            "matrix_key": sa.matrix_key,
            "status_a": sa.status.value,
            "status_b": sb.status.value,
            "duration_a": sa.duration_ms,
            "duration_b": sb.duration_ms,
        }
        if sa.status != sb.status:
            status_changed += 1
            entry["status_changed"] = True

        out_diffs = _diff_dict(sa.outputs or {}, sb.outputs or {})
        if out_diffs:
            entry["output_diffs"] = out_diffs

        if out_diffs or sa.status != sb.status:
            step_diffs.append(entry)

    return {
        "run_a": {"id": a.id, "started_at": a.started_at.isoformat(), "status": a.status.value},
        "run_b": {"id": b.id, "started_at": b.started_at.isoformat(), "status": b.status.value},
        "summary": {
            "total_steps_a": len(a_steps),
            "total_steps_b": len(b_steps),
            "only_in_a": only_in_a,
            "only_in_b": only_in_b,
            "status_changed": status_changed,
            "steps_with_diffs": len(step_diffs),
        },
        "step_diffs": step_diffs,
    }
