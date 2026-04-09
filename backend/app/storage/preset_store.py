from __future__ import annotations

from app.config import settings
from app.models.presets import Preset
from app.storage.yaml_store import YamlStore


class PresetStore:
    def __init__(self) -> None:
        self._store = YamlStore(settings.presets_dir)
        self._builtin = YamlStore(settings.resolved_data_dir / "presets")

    def list_all(self) -> list[Preset]:
        results = []
        for data in self._builtin.load_all():
            results.append(Preset(**data))
        for data in self._store.load_all():
            results.append(Preset(**data))
        return results

    def get(self, id_: str) -> Preset | None:
        data = self._store.load(id_) or self._builtin.load(id_)
        if data is None:
            return None
        return Preset(**data)

    def save(self, preset: Preset) -> Preset:
        self._store.save(preset.id, preset.model_dump(mode="json"))
        return preset

    def delete(self, id_: str) -> bool:
        return self._store.delete(id_)


preset_store = PresetStore()
