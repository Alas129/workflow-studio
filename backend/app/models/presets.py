from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class PresetParameter(BaseModel):
    step_type: str
    param_name: str
    value: Any


class Preset(BaseModel):
    id: str
    name: str
    description: str = ""
    tags: list[str] = []
    parameters: list[PresetParameter] = []
