from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.engine import init_db

# Import step modules to trigger @register_step decorators
import app.steps.http_request  # noqa: F401
import app.steps.llm_request  # noqa: F401
import app.steps.expand_matrix  # noqa: F401
import app.steps.inject_variables  # noqa: F401
import app.steps.load_targets  # noqa: F401
import app.steps.summarize_results  # noqa: F401
import app.steps.gcp_config  # noqa: F401

from app.routes import workflows, presets, steps, runs, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(workflows.router, prefix="/api")
    app.include_router(presets.router, prefix="/api")
    app.include_router(steps.router, prefix="/api")
    app.include_router(runs.router, prefix="/api")
    app.include_router(ws.router)

    # Serve frontend static files in production (when built and available)
    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

    return app


app = create_app()
