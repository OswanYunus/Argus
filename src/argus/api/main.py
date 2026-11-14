"""FastAPI main application for ARGUS OSINT Intelligence Platform."""

from __future__ import annotations

import contextlib
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from argus.api.events import router as events_router
from argus.api.routes.findings import router as findings_router
from argus.api.routes.identities import router as identities_router
from argus.api.routes.investigations import router as investigations_router
from argus.core.config import get_settings
from argus.core.crypto import init_crypto
from argus.core.db import close_db, init_db


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager: initialize database, crypto, and cleanup on shutdown."""
    settings = get_settings()

    # Initialize crypto
    init_crypto(settings.master_key)

    # Initialize SQLite database
    db_path = settings.database.path
    if str(db_path) != ":memory:":
        db_path = Path(db_path)
    await init_db(
        db_path=db_path,
        wal_mode=settings.database.wal_mode,
        busy_timeout_ms=settings.database.busy_timeout_ms,
    )

    yield

    # Teardown
    await close_db()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="ARGUS OSINT Intelligence Engine",
        description="Multi-stage evidence-driven intelligence collection and analysis platform.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS configuration for React frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers under /api/v1
    app.include_router(investigations_router, prefix="/api/v1")
    app.include_router(identities_router, prefix="/api/v1")
    app.include_router(findings_router, prefix="/api/v1")
    app.include_router(events_router, prefix="/api/v1")

    @app.get("/api/v1/health")
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": "ARGUS OSINT Engine"}

    # Serve compiled React frontend if present
    frontend_dist = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        from fastapi.staticfiles import StaticFiles
        from starlette.responses import FileResponse

        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                return None
            index_path = frontend_dist / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
            return {"message": "Frontend not found"}

    return app


app = create_app()
