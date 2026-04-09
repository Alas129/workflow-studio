from __future__ import annotations

from typing import Any


def should_fan_out(inputs: dict[str, Any]) -> bool:
    return "matrix" in inputs and isinstance(inputs["matrix"], list) and len(inputs["matrix"]) > 0


def expand_for_matrix(
    params: dict[str, Any],
    matrix_row: dict[str, Any],
    variables: dict[str, str],
) -> dict[str, Any]:
    merged = dict(params)
    for key, value in matrix_row.items():
        variables[key] = str(value)
    return merged
