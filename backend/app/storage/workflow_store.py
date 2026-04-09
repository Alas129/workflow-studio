from __future__ import annotations

from datetime import datetime, timezone

from app.config import settings
from app.models.workflows import WorkflowDefinition
from app.storage.yaml_store import YamlStore


class WorkflowStore:
    def __init__(self) -> None:
        self._store = YamlStore(settings.workflows_dir)
        self._builtin = YamlStore(settings.resolved_data_dir / "workflows")

    def list_all(self) -> list[WorkflowDefinition]:
        results = []
        for data in self._builtin.load_all():
            results.append(WorkflowDefinition(**data))
        for data in self._store.load_all():
            results.append(WorkflowDefinition(**data))
        return results

    def get(self, id_: str) -> WorkflowDefinition | None:
        data = self._store.load(id_) or self._builtin.load(id_)
        if data is None:
            return None
        return WorkflowDefinition(**data)

    def save(self, workflow: WorkflowDefinition) -> WorkflowDefinition:
        now = datetime.now(timezone.utc)
        if workflow.created_at is None:
            workflow.created_at = now
        workflow.updated_at = now
        self._store.save(workflow.id, workflow.model_dump(mode="json"))
        return workflow

    def delete(self, id_: str) -> bool:
        return self._store.delete(id_)

    def exists(self, id_: str) -> bool:
        return self._store.exists(id_) or self._builtin.exists(id_)


workflow_store = WorkflowStore()
