from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.secrets import list_secrets_with_source, set_secret, delete_secret

router = APIRouter(prefix="/secrets", tags=["Secrets"])


class SecretPayload(BaseModel):
    key: str
    value: str


@router.get("")
def list_secrets() -> dict[str, list[dict[str, str]]]:
    """List available secret keys with source (values never exposed)."""
    return {"keys": list_secrets_with_source()}


@router.post("")
def create_secret(payload: SecretPayload) -> dict[str, str]:
    """Create or update a file-based secret."""
    key = payload.key.strip().upper().replace(" ", "_")
    if not key:
        raise HTTPException(status_code=400, detail="Key cannot be empty")
    set_secret(key, payload.value)
    return {"key": key, "status": "created"}


@router.delete("/{key}")
def remove_secret(key: str) -> dict[str, bool]:
    """Delete a file-based secret."""
    deleted = delete_secret(key)
    if not deleted:
        raise HTTPException(status_code=404, detail="Secret not found or is environment-based")
    return {"deleted": True}
