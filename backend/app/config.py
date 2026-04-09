from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_title: str = "Workflow Studio"
    app_version: str = "0.1.0"

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    user_data_dir: Path | None = None
    data_dir: Path | None = None

    # Execution
    max_parallel_tasks: int = 10
    default_timeout: int = 180

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    model_config = {"env_prefix": "WS_"}

    @property
    def resolved_user_data_dir(self) -> Path:
        return self.user_data_dir or self.base_dir / "user_data"

    @property
    def resolved_data_dir(self) -> Path:
        return self.data_dir or self.base_dir / "data"

    @property
    def workflows_dir(self) -> Path:
        return self.resolved_user_data_dir / "workflows"

    @property
    def presets_dir(self) -> Path:
        return self.resolved_user_data_dir / "presets"

    @property
    def db_path(self) -> Path:
        return self.resolved_user_data_dir / "db" / "runs.db"


settings = Settings()
