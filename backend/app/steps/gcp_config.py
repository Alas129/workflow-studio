from __future__ import annotations

import asyncio
import json
import tempfile
from typing import Any

from app.steps.base import BaseStepHandler, StepExecutionError
from app.steps.registry import register_step
from app.engine.context import ExecutionContext


@register_step("gcp_config")
class GcpConfigStep(BaseStepHandler):

    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        operation = params.get("operation", "read")
        gcs_uri = context.resolve_variable(str(params.get("gcs_uri", "")))
        gsutil_path = params.get("gsutil_path", "gsutil")

        if not gcs_uri:
            raise StepExecutionError("gcs_uri is required")

        if operation == "read":
            return await self._read(gsutil_path, gcs_uri)
        elif operation == "write":
            content = params.get("content")
            if content is None:
                raise StepExecutionError("content is required for write operation")
            return await self._write(gsutil_path, gcs_uri, content)
        else:
            raise StepExecutionError(f"Unknown operation: {operation}")

    async def _read(self, gsutil: str, uri: str) -> dict[str, Any]:
        proc = await asyncio.create_subprocess_exec(
            gsutil, "cat", uri,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise StepExecutionError(f"gsutil cat failed: {stderr.decode()}")

        try:
            config = json.loads(stdout.decode())
        except json.JSONDecodeError:
            config = stdout.decode()

        return {"config": config, "operation": "read", "success": True}

    async def _write(self, gsutil: str, uri: str, content: Any) -> dict[str, Any]:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(content, f, indent=2)
            tmp_path = f.name

        proc = await asyncio.create_subprocess_exec(
            gsutil, "cp", tmp_path, uri,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise StepExecutionError(f"gsutil cp failed: {stderr.decode()}")

        return {"config": content, "operation": "write", "success": True}
