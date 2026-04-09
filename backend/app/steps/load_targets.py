from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("load_targets")
class LoadTargetsStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        source_type = params.get("source_type", "inline_json")
        data = params.get("data")

        if source_type == "inline_json":
            if not isinstance(data, list):
                raise StepExecutionError("data must be a list of objects for inline_json")
            targets = data

        elif source_type == "csv_file":
            path = Path(context.resolve_variable(str(data)))
            if not path.exists():
                raise StepExecutionError(f"CSV file not found: {path}")
            with open(path, newline="") as f:
                reader = csv.DictReader(f)
                targets = list(reader)

        elif source_type == "json_file":
            path = Path(context.resolve_variable(str(data)))
            if not path.exists():
                raise StepExecutionError(f"JSON file not found: {path}")
            with open(path) as f:
                targets = json.load(f)
                if not isinstance(targets, list):
                    raise StepExecutionError("JSON file must contain a list of objects")

        else:
            raise StepExecutionError(f"Unknown source_type: {source_type}")

        return {
            "matrix": targets,
            "count": len(targets),
        }
