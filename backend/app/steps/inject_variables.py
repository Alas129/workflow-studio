from __future__ import annotations

import json
import re
from typing import Any

from app.steps.base import BaseStepHandler
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("inject_variables")
class InjectVariablesStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        template = params.get("template", {})
        extra_vars = params.get("variables", {})

        # Merge extra vars into context
        for k, v in extra_vars.items():
            context.variables[k] = str(v)

        # Resolve template
        resolved = self._resolve_deep(template, context)

        return {"resolved": resolved}

    def _resolve_deep(self, obj: Any, context: ExecutionContext) -> Any:
        if isinstance(obj, str):
            return context.resolve_variable(obj)
        elif isinstance(obj, dict):
            return {k: self._resolve_deep(v, context) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._resolve_deep(item, context) for item in obj]
        return obj
