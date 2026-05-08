"""POST /api/batch — generate many QRs and return them as a ZIP archive."""

from __future__ import annotations

import re
import zipfile
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.qr import generate
from app.models import BatchRequest
from app.settings import settings

from .deps import rate_limit, require_api_key

router = APIRouter(dependencies=[Depends(require_api_key), Depends(rate_limit)])

_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9_.\-]+")


def _safe_filename(name: str | None, index: int, extension: str) -> str:
    base = (name or f"qr_{index + 1:04d}").strip() or f"qr_{index + 1:04d}"
    base = _FILENAME_SAFE.sub("_", base)[:120]
    return f"{base}.{extension}"


@router.post(
    "/batch",
    summary="Generate a batch of QR codes and return them as a ZIP archive.",
    response_class=Response,
    responses={
        200: {
            "content": {"application/zip": {}},
            "description": "ZIP archive of generated images.",
        },
        400: {"description": "Invalid request."},
        413: {"description": "Too many items in the batch."},
    },
)
def batch_post(req: BatchRequest) -> Response:
    if len(req.items) > settings.max_batch_items:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Batch exceeds maximum of {settings.max_batch_items} items.",
        )

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for index, item in enumerate(req.items):
            try:
                body, _ = generate(item.request)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Item {index}: {exc}",
                ) from exc
            extension = item.request.format if item.request.format != "jpeg" else "jpg"
            filename = _safe_filename(item.name, index, extension)
            archive.writestr(filename, body)

    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="qr-codes.zip"',
            "Cache-Control": "no-store",
        },
    )
