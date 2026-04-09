from __future__ import annotations

import itertools
from typing import Any

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("expand_matrix")
class ExpandMatrixStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        dimensions = params.get("dimensions", {})

        if not dimensions:
            raise StepExecutionError("dimensions is required and must be non-empty")

        keys = list(dimensions.keys())
        value_lists = [dimensions[k] for k in keys]

        matrix = []
        for combo in itertools.product(*value_lists):
            row = dict(zip(keys, combo))
            matrix.append(row)

        return {
            "matrix": matrix,
            "count": len(matrix),
            "dimensions": keys,
        }

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors = []
        dims = params.get("dimensions")
        if not dims or not isinstance(dims, dict):
            errors.append("dimensions must be a non-empty dict")
        return errors
