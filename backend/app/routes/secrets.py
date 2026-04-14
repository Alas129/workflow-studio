from __future__ import annotations

from fastapi import APIRouter

from app.secrets import list_secret_keys

router = APIRouter(prefix="/secrets", tags=["Secrets"])


@router.get("")
def list_secrets() -> dict[str, list[str]]:
    """List available secret keys (values never exposed)."""
    return {"keys": list_secret_keys()}
