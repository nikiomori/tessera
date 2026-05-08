"""Common FastAPI dependencies: API key check and rate limiting."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request, status

from app.settings import settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """If `TESSERA_API_KEY` is set in env, require a matching `X-API-Key` header."""
    if settings.api_key is None:
        return
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


# --- Tiny in-memory rate limiter (per-IP, per-minute) ----------------------
# Sufficient for a single-process self-host deploy. Behind a reverse proxy,
# ensure the proxy forwards a real client IP via X-Forwarded-For.

_buckets: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request) -> None:
    limit = settings.rate_limit_per_min
    if limit <= 0:
        return
    ip = _client_ip(request)
    now = time.monotonic()
    bucket = _buckets[ip]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({limit}/min).",
        )
    bucket.append(now)
