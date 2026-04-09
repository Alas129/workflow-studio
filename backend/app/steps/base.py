from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.engine.context import ExecutionContext


class StepExecutionError(Exception):
    pass


class BaseStepHandler(ABC):

    @abstractmethod
    async def execute(
        self,
        params: dict[str, Any],
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        ...

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        return []
