"""Colour parsing and gradient image building for the raster renderer."""

from __future__ import annotations

import math
from itertools import pairwise

from PIL import Image

from app.models import ColorOrGradient, Gradient, GradientStop

_RGBA = tuple[int, int, int, int]
_TRANSPARENT: _RGBA = (0, 0, 0, 0)


def parse_color(value: str | None, fallback: _RGBA = (0, 0, 0, 255)) -> _RGBA:
    """Convert a `#RRGGBB`, `#RRGGBBAA`, or `transparent` string to RGBA."""
    if value is None:
        return fallback
    if value == "transparent":
        return _TRANSPARENT
    if value.startswith("#") and len(value) in {7, 9}:
        r = int(value[1:3], 16)
        g = int(value[3:5], 16)
        b = int(value[5:7], 16)
        a = int(value[7:9], 16) if len(value) == 9 else 255
        return (r, g, b, a)
    raise ValueError(f"Unsupported colour value: {value!r}")


def is_transparent(spec: ColorOrGradient) -> bool:
    return spec.gradient is None and spec.color == "transparent"


def first_stop_color(spec: ColorOrGradient, fallback: str = "#000000") -> str:
    if spec.color and spec.color != "transparent":
        return spec.color
    if spec.gradient and spec.gradient.stops:
        return spec.gradient.stops[0].color
    return fallback


def _interpolate(stops: list[GradientStop], t: float) -> _RGBA:
    """Sample colour at position `t` (0-1) along ordered stops."""
    if t <= stops[0].offset:
        return parse_color(stops[0].color)
    if t >= stops[-1].offset:
        return parse_color(stops[-1].color)
    for left, right in pairwise(stops):
        if left.offset <= t <= right.offset:
            span = max(1e-9, right.offset - left.offset)
            local = (t - left.offset) / span
            lc = parse_color(left.color)
            rc = parse_color(right.color)
            return (
                int(lc[0] + (rc[0] - lc[0]) * local),
                int(lc[1] + (rc[1] - lc[1]) * local),
                int(lc[2] + (rc[2] - lc[2]) * local),
                int(lc[3] + (rc[3] - lc[3]) * local),
            )
    return parse_color(stops[-1].color)


def make_linear_gradient(size: int, gradient: Gradient) -> Image.Image:
    """Render a linear gradient as a square RGBA image.

    Implementation trick: build a 1px-tall horizontal strip with the gradient,
    stretch it vertically into a square, then rotate by `gradient.rotation`
    degrees and crop the centre. Pillow handles all of this in C, so it stays
    fast even at 4096px.
    """
    stops = sorted(gradient.stops, key=lambda s: s.offset)
    diagonal = max(2, int(size * math.sqrt(2)) + 4)
    strip = Image.new("RGBA", (diagonal, 1))
    pixels = strip.load()
    assert pixels is not None
    for i in range(diagonal):
        t = i / (diagonal - 1)
        pixels[i, 0] = _interpolate(stops, t)
    stretched = strip.resize((diagonal, diagonal), Image.Resampling.NEAREST)
    rotated = stretched.rotate(-gradient.rotation, expand=True, resample=Image.Resampling.BILINEAR)
    left = (rotated.width - size) // 2
    top = (rotated.height - size) // 2
    return rotated.crop((left, top, left + size, top + size))


def make_radial_gradient(size: int, gradient: Gradient) -> Image.Image:
    """Build a centre-out radial gradient. Computed at most 256x256 then upscaled."""
    work = min(size, 256)
    img = Image.new("RGBA", (work, work))
    pixels = img.load()
    assert pixels is not None
    stops = sorted(gradient.stops, key=lambda s: s.offset)
    cx, cy = work / 2, work / 2
    max_r = math.sqrt(2) * work / 2
    for y in range(work):
        for x in range(work):
            r = math.hypot(x - cx, y - cy)
            t = min(1.0, r / max_r)
            pixels[x, y] = _interpolate(stops, t)
    if work != size:
        img = img.resize((size, size), Image.Resampling.BILINEAR)
    return img


def make_color_layer(size: int, spec: ColorOrGradient) -> Image.Image:
    """Return a square RGBA image filled per `spec`."""
    if spec.gradient is not None:
        if spec.gradient.type == "radial":
            return make_radial_gradient(size, spec.gradient)
        return make_linear_gradient(size, spec.gradient)
    return Image.new("RGBA", (size, size), parse_color(spec.color))


def gradient_svg_def(elem_id: str, gradient: Gradient) -> str:
    """Return an SVG `<linearGradient>` / `<radialGradient>` defs entry."""
    stops = "".join(
        f'<stop offset="{s.offset}" stop-color="{s.color}"/>'
        for s in sorted(gradient.stops, key=lambda x: x.offset)
    )
    if gradient.type == "radial":
        return f'<radialGradient id="{elem_id}" cx="0.5" cy="0.5" r="0.5">{stops}</radialGradient>'
    rotation = gradient.rotation
    return (
        f'<linearGradient id="{elem_id}" '
        f'gradientTransform="rotate({rotation} 0.5 0.5)">{stops}</linearGradient>'
    )


def svg_fill_for(spec: ColorOrGradient, elem_id: str, defs: list[str]) -> str:
    """Return an SVG `fill` value, appending a gradient definition if needed."""
    if spec.gradient is not None:
        defs.append(gradient_svg_def(elem_id, spec.gradient))
        return f"url(#{elem_id})"
    return spec.color or "#000000"
