"""Manage snapshot baselines."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter(prefix="/baselines", tags=["Baselines"])


def _baseline_dir(workflow_id: str):
    return settings.resolved_user_data_dir / "baselines" / workflow_id


@router.get("/{workflow_id}")
def list_baselines(workflow_id: str) -> dict[str, list[str]]:
    path = _baseline_dir(workflow_id)
    if not path.exists():
        return {"names": []}
    names = [p.stem for p in path.glob("*.json")]
    return {"names": sorted(names)}


@router.get("/{workflow_id}/{name}")
def get_baseline(workflow_id: str, name: str):
    safe = name.replace("/", "_").replace("..", "_")
    path = _baseline_dir(workflow_id) / f"{safe}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Baseline not found")
    with open(path) as f:
        return json.load(f)


@router.delete("/{workflow_id}/{name}")
def delete_baseline(workflow_id: str, name: str) -> dict[str, bool]:
    safe = name.replace("/", "_").replace("..", "_")
    path = _baseline_dir(workflow_id) / f"{safe}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Baseline not found")
    path.unlink()
    return {"deleted": True}
