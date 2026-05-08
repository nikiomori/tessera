"""Tests for the logo decoding / silhouette / fetch pipeline."""

from __future__ import annotations

import base64
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.logo import (
    _normalise_to_png,
    fetch_logo_for_site,
    load_logo_image,
    prepare_silhouette_data,
    remove_background_by_color,
    sample_silhouette_colors,
    silhouette_modules,
)
from app.main import app
from app.models import LogoConfig, LogoMode


def _png_bytes(color: tuple[int, int, int, int] = (255, 0, 0, 255), size: int = 16) -> bytes:
    img = Image.new("RGBA", (size, size), color)
    buf = BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _ico_bytes() -> bytes:
    img = Image.new("RGBA", (32, 32), (0, 128, 255, 255))
    buf = BytesIO()
    img.save(buf, "ICO", sizes=[(16, 16), (32, 32)])
    return buf.getvalue()


def _logo_config(image_bytes: bytes, **overrides: object) -> LogoConfig:
    data_url = "data:image/png;base64," + base64.b64encode(image_bytes).decode()
    return LogoConfig(
        image_data_url=data_url,
        mode=LogoMode.SILHOUETTE,
        **overrides,  # type: ignore[arg-type]
    )


# ---------- _normalise_to_png -----------------------------------------------


def test_normalise_passes_through_png() -> None:
    out = _normalise_to_png(_png_bytes())
    assert out is not None
    assert out[:8] == b"\x89PNG\r\n\x1a\n"


def test_normalise_converts_ico_to_png() -> None:
    out = _normalise_to_png(_ico_bytes())
    assert out is not None
    assert out[:8] == b"\x89PNG\r\n\x1a\n"
    img = Image.open(BytesIO(out))
    assert img.mode == "RGBA"


def test_normalise_rejects_garbage() -> None:
    assert _normalise_to_png(b"not an image at all") is None
    assert _normalise_to_png(b"") is None


# ---------- load_logo_image -------------------------------------------------


def test_load_logo_image_round_trip() -> None:
    cfg = _logo_config(_png_bytes((10, 20, 30, 255)))
    img = load_logo_image(cfg)
    assert img.mode == "RGBA"
    assert img.size == (16, 16)


def test_load_logo_image_rejects_corrupt_data() -> None:
    cfg = LogoConfig(image_data_url="data:image/png;base64,bm90X2FuX2ltYWdl")
    with pytest.raises(ValueError, match="not a recognisable format"):
        load_logo_image(cfg)


def test_load_logo_image_routes_site_url_through_ssrf_guard() -> None:
    # site_url goes through fetch_logo_for_site, which must reject loopback —
    # i.e. /api/generate inherits the same SSRF protection as /api/logo-from-url.
    cfg = LogoConfig(site_url="http://127.0.0.1/")
    with pytest.raises(ValueError, match="private/loopback"):
        load_logo_image(cfg)


def test_load_logo_image_requires_some_source() -> None:
    cfg = LogoConfig()  # no image_data_url, no image_url, no site_url
    with pytest.raises(ValueError, match="image_data_url, image_url, or site_url"):
        load_logo_image(cfg)


# ---------- remove_background_by_color --------------------------------------


def test_remove_background_makes_target_transparent() -> None:
    img = Image.new("RGBA", (4, 4), (255, 255, 255, 255))
    img.putpixel((1, 1), (10, 10, 10, 255))  # one off-white pixel
    out = remove_background_by_color(img, (255, 255, 255, 255), threshold_pct=2)
    # White pixel(s) are now transparent
    assert out.getpixel((0, 0))[3] == 0
    # Off-white pixel remains
    assert out.getpixel((1, 1))[3] == 255


def test_remove_background_zero_threshold_only_exact() -> None:
    img = Image.new("RGBA", (2, 2), (255, 255, 255, 255))
    img.putpixel((1, 1), (254, 254, 254, 255))
    out = remove_background_by_color(img, (255, 255, 255, 255), threshold_pct=0)
    assert out.getpixel((0, 0))[3] == 0
    assert out.getpixel((1, 1))[3] == 255  # near-but-not-exact stays


# ---------- silhouette_modules + colour sampling ----------------------------


def test_silhouette_padding_ring_excludes_silhouette() -> None:
    cfg = _logo_config(_png_bytes((0, 0, 0, 255)))
    mask, _ = prepare_silhouette_data(cfg, logo_modules=8)
    silhouette, padding, _ = silhouette_modules(mask, matrix_size=20, space_around=1)
    assert silhouette
    assert silhouette.isdisjoint(padding)


def test_sample_silhouette_colors_picks_logo_pixels() -> None:
    cfg = _logo_config(_png_bytes((30, 200, 60, 255)))
    _, coloured = prepare_silhouette_data(cfg, logo_modules=8)
    silhouette, _, _ = silhouette_modules(coloured.split()[3], matrix_size=20, space_around=0)
    colors = sample_silhouette_colors(coloured, silhouette, matrix_size=20)
    assert colors  # not empty
    sample = next(iter(colors.values()))
    # Allow tiny resize loss; channels should be near (30, 200, 60).
    assert sample[3] == 255
    assert abs(sample[0] - 30) < 25
    assert abs(sample[1] - 200) < 25
    assert abs(sample[2] - 60) < 25


# ---------- fetch_logo_for_site (offline guards) ----------------------------


def test_fetch_logo_rejects_private_address() -> None:
    with pytest.raises(ValueError, match="private/loopback"):
        fetch_logo_for_site("http://127.0.0.1/")


def test_fetch_logo_rejects_unknown_scheme() -> None:
    with pytest.raises(ValueError, match="Invalid URL"):
        fetch_logo_for_site("ftp://example.com/")


# ---------- /api/logo-from-url endpoint guards ------------------------------


def test_api_logo_from_url_rejects_localhost() -> None:
    client = TestClient(app)
    response = client.post("/api/logo-from-url", json={"url": "http://127.0.0.1/"})
    assert response.status_code == 404
    assert "private/loopback" in response.json()["detail"]
