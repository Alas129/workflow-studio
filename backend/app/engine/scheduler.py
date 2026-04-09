from __future__ import annotations

from app.models.workflows import WorkflowDefinition, Connection
from app.models.steps import StepInstance


class DAGScheduler:

    def __init__(self, workflow: WorkflowDefinition):
        self._steps = {s.id: s for s in workflow.steps}
        self._connections = workflow.connections
        self._predecessors: dict[str, set[str]] = {}
        self._successors: dict[str, set[str]] = {}
        self._build_graph()

    def _build_graph(self) -> None:
        for sid in self._steps:
            self._predecessors[sid] = set()
            self._successors[sid] = set()
        for conn in self._connections:
            self._predecessors[conn.target_step_id].add(conn.source_step_id)
            self._successors[conn.source_step_id].add(conn.target_step_id)

    def get_ready_steps(self, completed: set[str]) -> list[StepInstance]:
        ready = []
        for sid, step in self._steps.items():
            if sid in completed:
                continue
            if self._predecessors[sid].issubset(completed):
                ready.append(step)
        return ready

    def get_start_steps(self) -> list[StepInstance]:
        return self.get_ready_steps(set())

    def get_inputs_for_step(self, step_id: str) -> list[Connection]:
        return [c for c in self._connections if c.target_step_id == step_id]

    def get_all_step_ids(self) -> list[str]:
        return list(self._steps.keys())
