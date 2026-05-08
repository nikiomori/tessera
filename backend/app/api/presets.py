"""GET /api/presets — list built-in style presets."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.presets import PRESETS, find_preset
from app.models import Preset

from .deps import rate_limit, require_api_key

router = APIRouter(dependencies=[Depends(require_api_key), Depends(rate_limit)])


@router.get("/presets", summary="List all built-in style presets.")
def list_presets() -> list[Preset]:
    return PRESETS


@router.get("/presets/{preset_id}", summary="Fetch a single preset by id.")
def get_preset(preset_id: str) -> Preset:
    preset = find_preset(preset_id)
    if preset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found.")
    return preset
