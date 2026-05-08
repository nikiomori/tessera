"""POST /api/generate and GET /api/generate routes."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.qr import generate
from app.models import (
    ColorOrGradient,
    CornerDotShape,
    CornerSquareShape,
    DotShape,
    GenerateRequest,
    StyleConfig,
    TextData,
    UrlData,
)

from .deps import rate_limit, require_api_key

router = APIRouter(dependencies=[Depends(require_api_key), Depends(rate_limit)])


@router.post(
    "/generate",
    summary="Generate a styled QR code from a JSON config.",
    response_class=Response,
    responses={
        200: {
            "content": {
                "image/png": {},
                "image/svg+xml": {},
                "image/jpeg": {},
                "image/webp": {},
            },
            "description": "Image bytes in the requested format.",
        },
        400: {"description": "Invalid configuration or unencodable payload."},
    },
)
def generate_post(req: GenerateRequest) -> Response:
    try:
        body, content_type = generate(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Response(
        content=body,
        media_type=content_type,
        headers={"Cache-Control": "no-store"},
    )


@router.get(
    "/generate",
    summary="Quick QR generation via query string (URL or plain text).",
    response_class=Response,
)
def generate_get(
    data: Annotated[str, Query(min_length=1, max_length=4296)],
    kind: Annotated[Literal["url", "text"], Query()] = "url",
    fg: Annotated[str, Query(pattern=r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")] = "#000000",
    bg: Annotated[
        str, Query(pattern=r"^(#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent)$")
    ] = "#FFFFFF",
    size: Annotated[int, Query(ge=128, le=2048)] = 512,
    margin: Annotated[int, Query(ge=0, le=20)] = 4,
    ec: Annotated[Literal["L", "M", "Q", "H"], Query()] = "M",
    dot: Annotated[DotShape, Query()] = DotShape.SQUARE,
    corner_square: Annotated[CornerSquareShape, Query(alias="cs")] = CornerSquareShape.SQUARE,
    corner_dot: Annotated[CornerDotShape, Query(alias="cd")] = CornerDotShape.SQUARE,
    fmt: Annotated[Literal["png", "svg", "jpeg", "webp"], Query(alias="format")] = "png",
) -> Response:
    payload = UrlData(url=data) if kind == "url" else TextData(text=data)
    style = StyleConfig(
        size=size,
        margin=margin,
        error_correction=ec,
        dot_shape=dot,
        corner_square_shape=corner_square,
        corner_dot_shape=corner_dot,
        dot_color=ColorOrGradient(color=fg),
        background=ColorOrGradient(color=bg),
    )
    req = GenerateRequest(data=payload, style=style, format=fmt)
    try:
        body, content_type = generate(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Response(
        content=body,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=300"},
    )
