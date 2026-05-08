"""POST /api/logo-from-url — given a website URL, fetch its brand logo.

Walks apple-touch-icon → `<link rel="icon">` → `/favicon.ico` → og:image →
Google's S2 favicon proxy and returns the first hit as a base64 data URL,
ready to drop into the QR config's `logo.image_data_url`.
"""

from __future__ import annotations

import base64
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status
from PIL import Image

from app.core.logo import fetch_logo_for_site
from app.models import LogoFromUrlRequest, LogoFromUrlResponse

from .deps import rate_limit, require_api_key

router = APIRouter(dependencies=[Depends(require_api_key), Depends(rate_limit)])


@router.post(
    "/logo-from-url",
    summary="Auto-fetch a website's brand logo (favicon / apple-touch-icon / og:image).",
)
def logo_from_url(req: LogoFromUrlRequest) -> LogoFromUrlResponse:
    try:
        raw, content_type, source = fetch_logo_for_site(req.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch logo: {exc}",
        ) from exc

    width: int | None = None
    height: int | None = None
    try:
        img = Image.open(BytesIO(raw))
        width, height = img.size
    except (OSError, ValueError):
        pass

    return LogoFromUrlResponse(
        image_data_url=f"data:{content_type};base64,{base64.b64encode(raw).decode()}",
        source=source,
        width=width,
        height=height,
    )
