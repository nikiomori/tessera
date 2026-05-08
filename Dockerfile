# syntax=docker/dockerfile:1.7

# ---- Stage 1: build the Vite frontend ------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml* ./frontend/
WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile || pnpm install
COPY frontend/ .
RUN pnpm build


# ---- Stage 2: Python runtime that also serves the SPA --------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    TESSERA_STATIC_DIR=/app/static

WORKDIR /app

# System deps for Pillow (libjpeg, zlib, freetype etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        zlib1g \
        libpng16-16 \
        libfreetype6 \
        libwebp7 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /app/frontend/dist ./static

RUN useradd --uid 10001 --create-home appuser
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=2).read()" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
