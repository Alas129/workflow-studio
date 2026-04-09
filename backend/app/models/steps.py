from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


class ParameterType(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    JSON = "json"
    SECRET = "secret"
    SELECT = "select"
    MULTILINE = "multiline"
    KEY_VALUE = "key_value"
    FILE_PATH = "file_path"


class ParameterSchema(BaseModel):
    name: str
    label: str
    type: ParameterType
    required: bool = False
    default: Any = None
    description: str = ""
    enum_values: list[str] | None = None
    placeholder: str = ""


class StepDefinition(BaseModel):
    type: str
    label: str
    category: str
    description: str
    icon: str = ""
    parameters: list[ParameterSchema]
    outputs: list[str] = []
    supports_matrix: bool = False
    color: str = "#4A90D9"


class StepInstance(BaseModel):
    id: str
    type: str
    label: str
    params: dict[str, Any] = {}
    position: dict[str, float] = {"x": 0, "y": 0}
    notes: str = ""
