from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.presets import Preset
from app.storage.preset_store import preset_store

router = APIRouter(prefix="/presets", tags=["Presets"])


@router.get("")
async def list_presets() -> list[Preset]:
    return preset_store.list_all()


@router.get("/{preset_id}")
async def get_preset(preset_id: str) -> Preset:
    preset = preset_store.get(preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset


@router.post("")
async def create_preset(preset: Preset) -> Preset:
    return preset_store.save(preset)


@router.put("/{preset_id}")
async def update_preset(preset_id: str, preset: Preset) -> Preset:
    preset.id = preset_id
    return preset_store.save(preset)


@router.delete("/{preset_id}")
async def delete_preset(preset_id: str) -> dict[str, bool]:
    deleted = preset_store.delete(preset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"deleted": True}
