from __future__ import annotations

from typing import Type

from app.steps.base import BaseStepHandler

_REGISTRY: dict[str, Type[BaseStepHandler]] = {}


def register_step(type_name: str):
    def decorator(cls: Type[BaseStepHandler]):
        _REGISTRY[type_name] = cls
        return cls
    return decorator


def get_handler(type_name: str) -> BaseStepHandler:
    cls = _REGISTRY.get(type_name)
    if cls is None:
        raise ValueError(f"Unknown step type: {type_name}")
    return cls()


def all_step_types() -> list[str]:
    return list(_REGISTRY.keys())


def get_registry() -> dict[str, Type[BaseStepHandler]]:
    return dict(_REGISTRY)
