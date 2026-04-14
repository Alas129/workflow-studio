"""Snapshot/baseline comparison step.

Stores a baseline of a value under a named key per workflow. On subsequent runs,
compares the current value against the baseline; fails if different.

Baseline files live in: user_data/baselines/{workflow_id}/{name}.json
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import settings
from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


def _baseline_path(workflow_id: str, name: str) -> Path:
    safe_name = name.replace("/", "_").replace("..", "_")
    return settings.resolved_user_data_dir / "baselines" / workflow_id / f"{safe_name}.json"


def _deep_diff(a: Any, b: Any, path: str = "$") -> list[str]:
    """Return human-readable diff entries between two JSON-like values."""
    if type(a) != type(b):
        return [f"{path}: type changed {type(a).__name__} -> {type(b).__name__}"]
    if isinstance(a, dict):
        diffs = []
        keys = set(a.keys()) | set(b.keys())
        for k in sorted(keys):
            sub_path = f"{path}.{k}"
            if k not in a:
                diffs.append(f"{sub_path}: added ({b[k]!r})")
            elif k not in b:
                diffs.append(f"{sub_path}: removed (was {a[k]!r})")
            else:
                diffs.extend(_deep_diff(a[k], b[k], sub_path))
        return diffs
    if isinstance(a, list):
        diffs = []
        if len(a) != len(b):
            diffs.append(f"{path}: length changed {len(a)} -> {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            diffs.extend(_deep_diff(x, y, f"{path}[{i}]"))
        return diffs
    if a != b:
        return [f"{path}: {a!r} -> {b!r}"]
    return []


@register_step("snapshot")
class SnapshotStep(BaseStepHandler):
    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        name = str(params.get("name", "")).strip()
        value = params.get("value")
        update = bool(params.get("update", False))
        workflow_id = str(params.get("workflow_id") or context.variables.get("_workflow_id", "default"))

        if not name:
            raise StepExecutionError("snapshot: 'name' is required")

        if isinstance(value, str):
            value = context.resolve_variable(value)
            # Try to parse JSON strings
            stripped = value.strip() if isinstance(value, str) else ""
            if stripped and stripped[0] in "{[":
                try:
                    value = json.loads(stripped)
                except json.JSONDecodeError:
                    pass

        path = _baseline_path(workflow_id, name)
        existed_before = path.exists()

        if update or not existed_before:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w") as f:
                json.dump(value, f, indent=2, sort_keys=True, default=str)
            return {
                "test_status": "pass",
                "action": "baseline_updated" if existed_before else "baseline_created",
                "path": str(path),
                "value": value,
                "message": f"Baseline '{name}' saved",
            }

        with open(path) as f:
            baseline = json.load(f)

        diffs = _deep_diff(baseline, value)
        passed = len(diffs) == 0

        result = {
            "test_status": "pass" if passed else "fail",
            "action": "compared",
            "name": name,
            "baseline": baseline,
            "current": value,
            "diffs": diffs,
            "message": (
                f"Snapshot '{name}' matches baseline"
                if passed
                else f"Snapshot '{name}' changed ({len(diffs)} diff(s))"
            ),
        }

        if not passed:
            raise StepExecutionError(result["message"])
        return result
