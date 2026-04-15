from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.engine import init_db
from app.scheduling import scheduler as bg_scheduler
from app.secrets import init_provider as init_secrets

# Import step modules to trigger @register_step decorators
import app.steps.http_request  # noqa: F401
import app.steps.llm_request  # noqa: F401
import app.steps.expand_matrix  # noqa: F401
import app.steps.inject_variables  # noqa: F401
import app.steps.load_targets  # noqa: F401
import app.steps.summarize_results  # noqa: F401
import app.steps.gcp_config  # noqa: F401
import app.steps.assertions  # noqa: F401
import app.steps.snapshot  # noqa: F401
import app.steps.notify  # noqa: F401

from app.routes import (
    workflows, presets, steps, runs, ws,
    schedules, suites, webhooks, secrets, baselines, uploads,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    init_secrets()
    bg_scheduler.start(poll_seconds=10)
    try:
        yield
    finally:
        await bg_scheduler.stop()


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
    app.include_router(schedules.router, prefix="/api")
    app.include_router(suites.router, prefix="/api")
    app.include_router(webhooks.router, prefix="/api")
    app.include_router(secrets.router, prefix="/api")
    app.include_router(baselines.router, prefix="/api")
    app.include_router(uploads.router, prefix="/api")
    app.include_router(ws.router)

    # Serve frontend static files in production (when built and available)
    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.is_dir():
        # Serve static assets (js, css, images)
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="static-assets")

        # SPA catch-all: any non-API, non-WS path serves index.html
        index_html = static_dir / "index.html"

        @app.get("/{path:path}")
        async def spa_fallback(request: Request, path: str):
            # Try to serve a real file first (e.g. favicon.ico)
            file_path = static_dir / path
            if path and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(index_html)

    return app


app = create_app()
