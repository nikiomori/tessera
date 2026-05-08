# Tessera · backend

FastAPI service that generates branded QR codes (PNG / SVG / JPEG / WebP) and
serves the built Vite frontend as static assets in production.

The renderer runs entirely in the request hot path — there is no queue, no
worker pool, no database. A typical generation takes under 100 ms.

## Local development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`. Interactive docs at `/api/docs`.

## Tests / lint / types

```bash
ruff check .         # style + many bug-class checks
ruff format .        # autoformat
mypy app             # strict typing
pytest -q            # 33 cases — encoders, renderer, logo pipeline
```

## Architecture

```
app/
├── api/
│   ├── generate.py      # POST/GET /api/generate
│   ├── batch.py         # POST /api/batch  → ZIP
│   ├── logo.py          # POST /api/logo-from-url
│   ├── presets.py       # GET  /api/presets[/<id>]
│   └── deps.py          # API-key + per-IP rate limit
├── core/
│   ├── encoders.py      # data type → QR string (vCard, WIFI:, mailto:, …)
│   ├── colors.py        # solid + linear/radial gradients
│   ├── logo.py          # decode, bg-removal, silhouette, auto-fetch
│   ├── qr.py            # renderer (segno → SVG / Pillow raster)
│   └── presets.py       # 12 built-in style presets
├── models/qr_config.py  # Pydantic v2 schemas — single source of truth
├── settings.py          # env-driven config
└── main.py              # FastAPI app + optional SPA mount
```

## Environment variables

| Name | Default | Purpose |
|---|---|---|
| `TESSERA_API_KEY` | _unset_ | If set, every `/api/*` request must send `X-API-Key: <value>`. |
| `TESSERA_RATE_LIMIT_PER_MIN` | `0` | Per-IP request limit per minute. `0` (default) disables limiting — appropriate for single-user self-host. Set to a positive value for public deploys. |
| `TESSERA_STATIC_DIR` | _unset_ | Path to the built frontend `dist/` folder. Set automatically inside the Docker image. |
| `TESSERA_CORS_ORIGINS` | `*` | Comma-separated CORS allowlist. |
| `TESSERA_MAX_BATCH_ITEMS` | `200` | Maximum items in a single `/api/batch` request. |

A sample `.env.example` lives at the repo root.
