"""FastAPI application entry point.

In development, the frontend runs separately on port 5173 and proxies `/api/*`
to this server (port 8000).

In production (inside the Docker image) `TESSERA_STATIC_DIR` points at the
built `dist/` folder; FastAPI then also serves the SPA, falling back to
`index.html` for any non-API path so client-side routing works.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from app import __version__
from app.api import batch as batch_routes
from app.api import generate as generate_routes
from app.api import logo as logo_routes
from app.api import presets as presets_routes
from app.settings import settings

logger = logging.getLogger("tessera")

app = FastAPI(
    title="Tessera API",
    version=__version__,
    description="Open source QR code generator with logo embedding and rich styling.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(generate_routes.router, prefix="/api", tags=["qr"])
app.include_router(batch_routes.router, prefix="/api", tags=["qr"])
app.include_router(logo_routes.router, prefix="/api", tags=["logo"])
app.include_router(presets_routes.router, prefix="/api", tags=["presets"])


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# --- Static SPA mount -------------------------------------------------------
# Only mounted if TESSERA_STATIC_DIR is set and exists. This is the path the
# Docker image uses; in `pnpm dev` the frontend runs on its own server so this
# block stays inactive.

_static_dir: Path | None = Path(settings.static_dir).resolve() if settings.static_dir else None
if _static_dir is not None and _static_dir.is_dir():
    static_root: Path = _static_dir
    app.mount(
        "/assets",
        StaticFiles(directory=static_root / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404)
        candidate = static_root / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(static_root / "index.html")

    logger.info("Serving SPA from %s", static_root)
else:
    logger.info("TESSERA_STATIC_DIR not set — running API-only.")
