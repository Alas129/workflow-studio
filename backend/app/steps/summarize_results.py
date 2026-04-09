from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.steps.base import BaseStepHandler
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("summarize_results")
class SummarizeResultsStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        group_by = params.get("group_by", [])
        metrics = params.get("metrics", ["status_code", "duration_ms"])

        # Collect all matrix results from inputs
        matrix_results = inputs.get("_matrix_results", [])
        if not matrix_results:
            # Fallback: treat inputs as a single result
            matrix_results = [inputs]

        # Group results
        groups: dict[str, list[dict]] = defaultdict(list)
        for result in matrix_results:
            key_parts = []
            for field in group_by:
                key_parts.append(f"{field}={result.get(field, 'unknown')}")
            key = "|".join(key_parts) if key_parts else "all"
            groups[key].append(result)

        # Compute summary per group
        summary: dict[str, Any] = {}
        table: list[dict[str, Any]] = []

        for group_key, items in groups.items():
            group_summary: dict[str, Any] = {"count": len(items)}

            for metric in metrics:
                values = [item.get(metric) for item in items if item.get(metric) is not None]
                if not values:
                    continue

                if all(isinstance(v, (int, float)) for v in values):
                    sorted_vals = sorted(values)
                    group_summary[metric] = {
                        "min": min(sorted_vals),
                        "max": max(sorted_vals),
                        "avg": sum(sorted_vals) / len(sorted_vals),
                        "p50": sorted_vals[len(sorted_vals) // 2],
                    }
                else:
                    # Count distinct values
                    counts: dict[str, int] = defaultdict(int)
                    for v in values:
                        counts[str(v)] += 1
                    group_summary[metric] = dict(counts)

            summary[group_key] = group_summary

            # Build table rows
            for item in items:
                row: dict[str, Any] = {}
                for field in group_by:
                    row[field] = item.get(field)
                for metric in metrics:
                    row[metric] = item.get(metric)
                row["_group"] = group_key
                table.append(row)

        total = len(matrix_results)
        success_count = sum(
            1 for r in matrix_results
            if isinstance(r.get("status_code"), int) and 200 <= r["status_code"] < 300
        )

        return {
            "summary": summary,
            "table": table,
            "total": total,
            "success_count": success_count,
            "success_rate": round(success_count / total * 100, 1) if total > 0 else 0,
        }
