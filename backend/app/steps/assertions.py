"""Assertion steps for testing workflows.

Each assert step returns a standard output shape:
    { "test_status": "pass" | "fail", "message": str, "expected": ..., "actual": ... }

Failure raises StepExecutionError so the step (and run) are marked failed, but
the `test_status` is surfaced in outputs for reporting (JUnit, diff, etc).
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


def _resolve_json_path(data: Any, path: str) -> Any:
    """Minimal JSONPath subset: `$.a.b[0].c` or `a.b[0].c`."""
    if path.startswith("$"):
        path = path[1:]
    if path.startswith("."):
        path = path[1:]
    if not path:
        return data

    cur = data
    tokens = re.findall(r"[^.\[\]]+|\[\d+\]", path)
    for tok in tokens:
        if tok.startswith("[") and tok.endswith("]"):
            idx = int(tok[1:-1])
            if not isinstance(cur, list):
                raise StepExecutionError(f"Path {path!r}: expected list at {tok!r}, got {type(cur).__name__}")
            if idx >= len(cur):
                raise StepExecutionError(f"Path {path!r}: index {idx} out of range (len={len(cur)})")
            cur = cur[idx]
        else:
            if not isinstance(cur, dict):
                raise StepExecutionError(f"Path {path!r}: expected object at {tok!r}, got {type(cur).__name__}")
            if tok not in cur:
                raise StepExecutionError(f"Path {path!r}: key {tok!r} not found")
            cur = cur[tok]
    return cur


def _coerce_match(value: Any) -> Any:
    """If string looks like JSON, parse it — makes user input tolerant."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped[0] in "{[" and stripped[-1] in "}]":
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                return value
    return value


def _type_of(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


@register_step("assert_equals")
class AssertEqualsStep(BaseStepHandler):
    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        actual = params.get("actual")
        expected = params.get("expected")
        if isinstance(actual, str):
            actual = context.resolve_variable(actual)
            actual = _coerce_match(actual)
        if isinstance(expected, str):
            expected = context.resolve_variable(expected)
            expected = _coerce_match(expected)

        passed = actual == expected
        result = {
            "test_status": "pass" if passed else "fail",
            "assertion": "equals",
            "expected": expected,
            "actual": actual,
            "message": "Values match" if passed else f"Expected {expected!r}, got {actual!r}",
        }
        if not passed:
            raise StepExecutionError(result["message"])
        return result


@register_step("assert_contains")
class AssertContainsStep(BaseStepHandler):
    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        haystack = params.get("haystack")
        needle = params.get("needle")
        if isinstance(haystack, str):
            haystack = context.resolve_variable(haystack)
        if isinstance(needle, str):
            needle = context.resolve_variable(needle)

        passed = False
        if isinstance(haystack, str) and isinstance(needle, str):
            passed = needle in haystack
        elif isinstance(haystack, list):
            passed = needle in haystack
        elif isinstance(haystack, dict) and isinstance(needle, str):
            passed = needle in haystack

        result = {
            "test_status": "pass" if passed else "fail",
            "assertion": "contains",
            "needle": needle,
            "haystack_type": _type_of(haystack),
            "message": "Needle found" if passed else f"{needle!r} not found in {_type_of(haystack)}",
        }
        if not passed:
            raise StepExecutionError(result["message"])
        return result


@register_step("assert_json_path")
class AssertJsonPathStep(BaseStepHandler):
    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        data = params.get("data")
        path = str(params.get("path", "$"))
        expected = params.get("expected")
        operator = params.get("operator", "equals")

        if isinstance(data, str):
            data = context.resolve_variable(data)
            data = _coerce_match(data)
        if isinstance(expected, str):
            expected = context.resolve_variable(expected)
            expected = _coerce_match(expected)

        actual = _resolve_json_path(data, path)

        ops = {
            "equals": lambda a, e: a == e,
            "not_equals": lambda a, e: a != e,
            "greater_than": lambda a, e: a > e,
            "less_than": lambda a, e: a < e,
            "exists": lambda a, e: a is not None,
            "matches_regex": lambda a, e: bool(re.search(str(e), str(a))),
        }
        if operator not in ops:
            raise StepExecutionError(f"Unknown operator: {operator}")

        passed = bool(ops[operator](actual, expected))
        result = {
            "test_status": "pass" if passed else "fail",
            "assertion": "json_path",
            "path": path,
            "operator": operator,
            "expected": expected,
            "actual": actual,
            "message": (
                f"{path} {operator} check passed"
                if passed
                else f"At {path}: expected {operator} {expected!r}, got {actual!r}"
            ),
        }
        if not passed:
            raise StepExecutionError(result["message"])
        return result


@register_step("assert_json_schema")
class AssertJsonSchemaStep(BaseStepHandler):
    """Lightweight schema check. Schema supports: type, required, properties.

    Example schema:
        {"type": "object", "required": ["id"], "properties": {"id": {"type": "string"}}}
    """

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        data = params.get("data")
        schema = params.get("schema")

        if isinstance(data, str):
            data = context.resolve_variable(data)
            data = _coerce_match(data)
        if not isinstance(schema, dict):
            raise StepExecutionError("schema must be a JSON object")

        errors: list[str] = []
        self._check(data, schema, "$", errors)

        passed = len(errors) == 0
        result = {
            "test_status": "pass" if passed else "fail",
            "assertion": "json_schema",
            "errors": errors,
            "message": "Schema valid" if passed else f"{len(errors)} schema violation(s): {'; '.join(errors[:3])}",
        }
        if not passed:
            raise StepExecutionError(result["message"])
        return result

    def _check(self, data: Any, schema: dict[str, Any], path: str, errors: list[str]) -> None:
        expected_type = schema.get("type")
        if expected_type:
            actual_type = _type_of(data)
            # allow integer to satisfy "number"
            if expected_type == "number" and actual_type == "integer":
                pass
            elif actual_type != expected_type:
                errors.append(f"{path}: expected {expected_type}, got {actual_type}")
                return

        if expected_type == "object" and isinstance(data, dict):
            for req_key in schema.get("required", []):
                if req_key not in data:
                    errors.append(f"{path}: missing required key {req_key!r}")
            for key, sub_schema in schema.get("properties", {}).items():
                if key in data:
                    self._check(data[key], sub_schema, f"{path}.{key}", errors)

        if expected_type == "array" and isinstance(data, list):
            items_schema = schema.get("items")
            if isinstance(items_schema, dict):
                for i, item in enumerate(data):
                    self._check(item, items_schema, f"{path}[{i}]", errors)
