"""Top-level QR rendering pipeline.

Logo handling: the logo's opaque pixels form a *mask*. Modules under the
mask get the *logo dot color/scale*; modules in the surrounding *padding
ring* are left blank to give the logo breathing room.

Pipeline:
    payload (DataPayload)  --encoders.encode_payload-->  string
    string                 --segno.make-->               module matrix
    matrix + style + logo  --render_svg / render_raster-> bytes
"""

from __future__ import annotations

from collections.abc import Iterable
from io import BytesIO

import segno
from PIL import Image, ImageDraw

from app.models import (
    CornerDotShape,
    CornerSquareShape,
    DotShape,
    GenerateRequest,
    ImageFormat,
    LogoConfig,
    StyleConfig,
)

from .colors import (
    first_stop_color,
    is_transparent,
    make_color_layer,
    parse_color,
    svg_fill_for,
)
from .encoders import encode_payload
from .logo import (
    mean_silhouette_color,
    prepare_silhouette_data,
    sample_silhouette_colors,
    silhouette_bounding_box,
    silhouette_modules,
)

_FINDER_SIZE = 7  # modules

# Alignment-pattern centre positions per QR version, from ISO/IEC 18004 Annex E.
# Each version's tuple lists row/column positions; alignment patterns sit at every
# (px, py) combination *except* the three that overlap finder corners.
_ALIGNMENT_POSITIONS: dict[int, tuple[int, ...]] = {
    1: (),
    2: (6, 18),
    3: (6, 22),
    4: (6, 26),
    5: (6, 30),
    6: (6, 34),
    7: (6, 22, 38),
    8: (6, 24, 42),
    9: (6, 26, 46),
    10: (6, 28, 50),
    11: (6, 30, 54),
    12: (6, 32, 58),
    13: (6, 34, 62),
    14: (6, 26, 46, 66),
    15: (6, 26, 48, 70),
    16: (6, 26, 50, 74),
    17: (6, 30, 54, 78),
    18: (6, 30, 56, 82),
    19: (6, 30, 58, 86),
    20: (6, 34, 62, 90),
    21: (6, 28, 50, 72, 94),
    22: (6, 26, 50, 74, 98),
    23: (6, 30, 54, 78, 102),
    24: (6, 28, 54, 80, 106),
    25: (6, 32, 58, 84, 110),
    26: (6, 30, 58, 86, 114),
    27: (6, 34, 62, 90, 118),
    28: (6, 26, 50, 74, 98, 122),
    29: (6, 30, 54, 78, 102, 126),
    30: (6, 26, 52, 78, 104, 130),
    31: (6, 30, 56, 82, 108, 134),
    32: (6, 34, 60, 86, 112, 138),
    33: (6, 30, 58, 86, 114, 142),
    34: (6, 34, 62, 90, 118, 146),
    35: (6, 30, 54, 78, 102, 126, 150),
    36: (6, 24, 50, 76, 102, 128, 154),
    37: (6, 28, 54, 80, 106, 132, 158),
    38: (6, 32, 58, 84, 110, 136, 162),
    39: (6, 26, 54, 82, 110, 138, 166),
    40: (6, 30, 58, 86, 114, 142, 170),
}


def _alignment_boxes(n: int) -> set[tuple[int, int]]:
    """Module coordinates covered by every 5x5 alignment pattern in this matrix.

    Alignment patterns are mandatory grid-registration anchors for QR versions ≥ 2.
    A silhouette/padding ring that erases or recolours these modules destroys the
    decoder's ability to unwarp the grid, so we keep them out of both sets.
    """
    version = (n - 21) // 4 + 1
    positions = _ALIGNMENT_POSITIONS.get(version, ())
    if not positions:
        return set()
    last = positions[-1]
    boxes: set[tuple[int, int]] = set()
    for cx in positions:
        for cy in positions:
            # Skip the three centres that overlap the finder corners.
            if (cx == 6 and cy == 6) or (cx == 6 and cy == last) or (cx == last and cy == 6):
                continue
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    boxes.add((cx + dx, cy + dy))
    return boxes


def _matrix_from(
    data_string: str,
    error_correction: str,
    matrix_version: int | None,
) -> list[list[bool]]:
    """Return a square matrix of booleans (True = dark module)."""
    error = error_correction.lower()
    if matrix_version is not None:
        try:
            qr = segno.make(data_string, error=error, version=matrix_version)
        except Exception:
            # Forced version too small for this payload — fall back to auto.
            qr = segno.make(data_string, error=error)
    else:
        qr = segno.make(data_string, error=error)
    return [[bool(cell) for cell in row] for row in qr.matrix]


def _auto_detail_floor(size_ratio: float) -> int:
    """Lift the QR matrix-version floor when a logo is present.

    Bigger logos eat more modules → we need a denser grid for the silhouette
    to retain enough resolution. Tuned empirically: at size_ratio≈0.6 we want
    roughly version 13-14 (a ~73-module matrix). Capped at 18 to keep the
    individual dots big enough to scan reliably at typical render sizes.
    """
    target_modules = round(40 + 70 * max(0.0, min(0.95, size_ratio)))
    version = max(8, (target_modules - 21) // 4 + 1)
    return min(version, 18)


def _finder_origins(n: int) -> list[tuple[int, int]]:
    """Top-left corners of the three finder patterns, in module coordinates."""
    return [(0, 0), (n - _FINDER_SIZE, 0), (0, n - _FINDER_SIZE)]


def _in_finder(x: int, y: int, n: int) -> bool:
    return (
        (x < _FINDER_SIZE and y < _FINDER_SIZE)
        or (x >= n - _FINDER_SIZE and y < _FINDER_SIZE)
        or (x < _FINDER_SIZE and y >= n - _FINDER_SIZE)
    )


def _data_modules(matrix: list[list[bool]]) -> Iterable[tuple[int, int]]:
    n = len(matrix)
    for y in range(n):
        row = matrix[y]
        for x in range(n):
            if row[x] and not _in_finder(x, y, n):
                yield x, y


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def generate(req: GenerateRequest) -> tuple[bytes, str]:
    """Render the QR code, returning ``(bytes, content_type)``."""
    payload_string = encode_payload(req.data)
    effective_error = _resolve_error_correction(req.style)
    effective_version = _resolve_matrix_version(req.style)
    matrix = _matrix_from(payload_string, effective_error, effective_version)
    if req.format == "svg":
        body = render_svg(matrix, req.style)
        return body, "image/svg+xml"
    body = render_raster(matrix, req.style, req.format)
    return body, _content_type_for(req.format)


def _resolve_matrix_version(style: StyleConfig) -> int | None:
    """Decide the QR matrix version, respecting an explicit override."""
    if style.matrix_version is not None:
        return style.matrix_version
    if style.logo is not None and style.logo.auto_detail:
        return _auto_detail_floor(style.logo.size_ratio)
    return None


def _resolve_error_correction(style: StyleConfig) -> str:
    """Force `H` whenever a logo is present — silhouette mode loses ~25% of modules."""
    if style.logo is not None:
        return "H"
    return style.error_correction


def _content_type_for(fmt: ImageFormat) -> str:
    return {
        "png": "image/png",
        "svg": "image/svg+xml",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }[fmt]


def _silhouette_sets(
    matrix_size: int,
    logo: LogoConfig,
    style: StyleConfig,
) -> tuple[
    set[tuple[int, int]],
    set[tuple[int, int]],
    dict[tuple[int, int], tuple[int, int, int, int]],
    dict[tuple[int, int], float],
]:
    """Return ``(silhouette, padding, colour_map, coverage)``.

    ``coverage`` maps modules to their sub-pixel coverage fraction; the
    renderer uses it to shrink edge dots for smoother contours.
    """
    logo_modules = max(4, int(matrix_size * logo.size_ratio))
    # Keep the logo region clear of the finder corners.
    logo_modules = min(logo_modules, matrix_size - 16)
    subpixel = max(1, logo.subpixel)
    mask, coloured = prepare_silhouette_data(logo, logo_modules, subpixel=subpixel)
    silhouette, padding, coverage = silhouette_modules(
        mask, matrix_size, logo.space_around, subpixel=subpixel
    )

    alignment = _alignment_boxes(matrix_size)
    if alignment:
        # Alignment patterns must survive intact for the decoder to register the
        # grid. We *keep* them in ``silhouette`` so dark alignment modules get
        # the logo colour (blending in visually), but pull them out of
        # ``padding`` so the dark ring/centre never gets cleared. ``coverage``
        # is forced to 1.0 for these cells so edge-blending doesn't shrink the
        # alignment dots and ruin contrast.
        padding -= alignment
        for cell in alignment:
            coverage[cell] = 1.0

    if logo.preserve_logo_colors:
        colour_map = sample_silhouette_colors(coloured, silhouette, matrix_size)
    else:
        colour_map = {}

    if logo.auto_contrast and silhouette:
        if logo.preserve_logo_colors:
            mean = mean_silhouette_color(coloured, silhouette, matrix_size)
        else:
            mean = parse_color(logo.logo_dot_color)
        if mean is not None and _colors_too_close(mean, style):
            # Widen the padding ring so a same-colour logo still has a clean
            # outline against the QR. We deliberately do *not* bump
            # ``logo_dot_scale`` beyond 1.0 — scales > 1 make silhouette dots
            # bleed into neighbouring modules and break scanability.
            eff_space = max(logo.space_around, 2)
            silhouette, padding, coverage = silhouette_modules(
                mask, matrix_size, eff_space, subpixel=subpixel
            )
            if alignment:
                padding -= alignment
                for cell in alignment:
                    coverage[cell] = 1.0
            if logo.preserve_logo_colors:
                colour_map = sample_silhouette_colors(coloured, silhouette, matrix_size)
    return silhouette, padding, colour_map, coverage


def _colors_too_close(
    logo_color: tuple[int, int, int, int],
    style: StyleConfig,
) -> bool:
    """True when the logo colour is too close to the QR's dot colour to read."""
    if style.dot_color.gradient is not None:
        ref_hex = style.dot_color.gradient.stops[0].color
    else:
        ref_hex = style.dot_color.color or "#000000"
    ref = parse_color(ref_hex)
    dr = logo_color[0] - ref[0]
    dg = logo_color[1] - ref[1]
    db = logo_color[2] - ref[2]
    # 60 ~ comfortable separation in 0..441 RGB euclidean distance.
    return (dr * dr + dg * dg + db * db) < 60 * 60


# ---------------------------------------------------------------------------
# SVG renderer (no logo — silhouette/logo configs are routed through raster)
# ---------------------------------------------------------------------------


def render_svg(matrix: list[list[bool]], style: StyleConfig) -> bytes:
    n = len(matrix)
    margin = style.margin
    total = n + 2 * margin
    px = style.size
    mod = px / total

    defs: list[str] = []
    fg_fill = svg_fill_for(style.dot_color, "fg-grad", defs)
    bg_present = not is_transparent(style.background)
    bg_fill = svg_fill_for(style.background, "bg-grad", defs) if bg_present else "transparent"

    sq_color = style.corner_square_color or first_stop_color(style.dot_color)
    dot_color = style.corner_dot_color or first_stop_color(style.dot_color)

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{px}" height="{px}" viewBox="0 0 {px} {px}" shape-rendering="geometricPrecision">'
    ]
    if defs:
        parts.append("<defs>")
        parts.extend(defs)
        parts.append("</defs>")
    if bg_present:
        parts.append(f'<rect width="{px}" height="{px}" fill="{bg_fill}"/>')

    for x, y in _data_modules(matrix):
        parts.append(
            _svg_dot(margin + x, margin + y, mod, style.dot_shape, fg_fill, style.dot_scale)
        )

    hole_color = style.background.color if (bg_present and style.background.color) else "#FFFFFF"
    for fx, fy in _finder_origins(n):
        parts.append(
            _svg_finder(
                margin + fx,
                margin + fy,
                mod,
                style.corner_square_shape,
                style.corner_dot_shape,
                sq_color,
                dot_color,
                hole_color,
            )
        )

    parts.append("</svg>")
    return "".join(parts).encode("utf-8")


def _svg_dot(mx: float, my: float, mod: float, shape: str, fill: str, scale: float = 1.0) -> str:
    inset = mod * (1 - max(0.1, scale)) / 2
    px = mx * mod + inset
    py = my * mod + inset
    side = mod - 2 * inset
    if shape == DotShape.DOTS.value:
        return f'<circle cx="{px + side / 2}" cy="{py + side / 2}" r="{side / 2}" fill="{fill}"/>'
    if shape == DotShape.ROUNDED.value:
        return f'<rect x="{px}" y="{py}" width="{side}" height="{side}" rx="{side * 0.3}" fill="{fill}"/>'
    if shape == DotShape.EXTRA_ROUNDED.value:
        return f'<rect x="{px}" y="{py}" width="{side}" height="{side}" rx="{side * 0.45}" fill="{fill}"/>'
    if shape == DotShape.CLASSY.value:
        return f'<rect x="{px}" y="{py}" width="{side}" height="{side}" rx="{side * 0.22}" fill="{fill}"/>'
    return f'<rect x="{px}" y="{py}" width="{side}" height="{side}" fill="{fill}"/>'


def _svg_finder(
    ox: int,
    oy: int,
    mod: float,
    sq_shape: str,
    dot_shape: str,
    sq_color: str,
    dot_color: str,
    hole_color: str,
) -> str:
    x = ox * mod
    y = oy * mod
    s7 = 7 * mod
    s5 = 5 * mod
    s3 = 3 * mod
    cx = x + s7 / 2
    cy = y + s7 / 2

    if sq_shape == CornerSquareShape.DOT.value:
        outer = f'<circle cx="{cx}" cy="{cy}" r="{s7 / 2}" fill="{sq_color}"/>'
        hole = f'<circle cx="{cx}" cy="{cy}" r="{s5 / 2}" fill="{hole_color}"/>'
    elif sq_shape == CornerSquareShape.ROUNDED.value:
        outer = (
            f'<rect x="{x}" y="{y}" width="{s7}" height="{s7}" rx="{s7 * 0.3}" fill="{sq_color}"/>'
        )
        hole = (
            f'<rect x="{x + mod}" y="{y + mod}" width="{s5}" height="{s5}" '
            f'rx="{s5 * 0.3}" fill="{hole_color}"/>'
        )
    else:
        outer = f'<rect x="{x}" y="{y}" width="{s7}" height="{s7}" fill="{sq_color}"/>'
        hole = f'<rect x="{x + mod}" y="{y + mod}" width="{s5}" height="{s5}" fill="{hole_color}"/>'

    if dot_shape == CornerDotShape.DOT.value:
        inner = f'<circle cx="{cx}" cy="{cy}" r="{s3 / 2}" fill="{dot_color}"/>'
    else:
        inner = (
            f'<rect x="{x + 2 * mod}" y="{y + 2 * mod}" width="{s3}" height="{s3}" '
            f'fill="{dot_color}"/>'
        )

    return outer + hole + inner


# ---------------------------------------------------------------------------
# Raster renderer (PNG / JPEG / WEBP via Pillow)
# ---------------------------------------------------------------------------


def render_raster(matrix: list[list[bool]], style: StyleConfig, fmt: ImageFormat) -> bytes:
    n = len(matrix)
    margin = style.margin
    total = n + 2 * margin
    px = style.size
    mod = px / total

    silhouette: set[tuple[int, int]] = set()
    padding: set[tuple[int, int]] = set()
    colour_map: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    coverage: dict[tuple[int, int], float] = {}
    if style.logo:
        silhouette, padding, colour_map, coverage = _silhouette_sets(n, style.logo, style)

    canvas = _make_background(px, style)

    _paint_modules(
        canvas,
        matrix,
        mod,
        margin,
        style,
        silhouette=silhouette,
        padding=padding,
        colour_map=colour_map,
        coverage=coverage,
        eff_logo_scale=style.logo.logo_dot_scale if style.logo else 1.0,
    )
    _paint_finders(canvas, n, mod, margin, style)

    if style.logo and style.logo.draw_border:
        _draw_silhouette_border(canvas, silhouette, padding, mod, margin)

    return _encode_image(canvas, fmt, style)


def _make_background(size: int, style: StyleConfig) -> Image.Image:
    if is_transparent(style.background):
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    return make_color_layer(size, style.background)


def _paint_modules(
    canvas: Image.Image,
    matrix: list[list[bool]],
    mod: float,
    margin: int,
    style: StyleConfig,
    silhouette: set[tuple[int, int]],
    padding: set[tuple[int, int]],
    colour_map: dict[tuple[int, int], tuple[int, int, int, int]],
    coverage: dict[tuple[int, int], float] | None = None,
    eff_logo_scale: float | None = None,
) -> None:
    """Draw all data modules, routing each to the right colour/scale based on logo.

    Order of preference for the colour of a *silhouette* module:
        1. ``colour_map[(x, y)]`` — sampled from the original logo image
           (when ``preserve_logo_colors`` is on).
        2. ``logo.logo_dot_color`` — the explicit silhouette colour.

    Modules outside the silhouette use ``style.dot_color`` (solid or gradient).
    Edge modules (sub-pixel coverage between 0 and 1) get their dot scale
    interpolated towards the surrounding scale for smoother contours.
    """
    has_silhouette = bool(silhouette)
    use_gradient = style.dot_color.gradient is not None
    coverage = coverage or {}

    if use_gradient:
        mask = Image.new("L", canvas.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        for x, y in _data_modules(matrix):
            if has_silhouette and (x, y) in padding:
                continue
            if has_silhouette and (x, y) in silhouette:
                continue
            _draw_dot_raster(
                mask_draw,
                (margin + x) * mod,
                (margin + y) * mod,
                mod,
                style.dot_shape,
                style.dot_scale,
                255,
            )
        fg = make_color_layer(canvas.size[0], style.dot_color)
        canvas.paste(fg, (0, 0), mask)
        if has_silhouette:
            draw = ImageDraw.Draw(canvas)
            fallback = (
                parse_color(style.logo.logo_dot_color) if style.logo else parse_color("#000000")
            )
            base_logo_scale = (
                eff_logo_scale
                if eff_logo_scale is not None
                else (style.logo.logo_dot_scale if style.logo else style.dot_scale)
            )
            for x, y in silhouette:
                if not _safe_get(matrix, x, y) or _in_finder(x, y, len(matrix)):
                    continue
                colour = colour_map.get((x, y), fallback)
                scale = _edge_scale(coverage.get((x, y), 1.0), base_logo_scale, style.dot_scale)
                _draw_dot_raster(
                    draw,
                    (margin + x) * mod,
                    (margin + y) * mod,
                    mod,
                    style.dot_shape,
                    scale,
                    colour,
                )
        return

    draw = ImageDraw.Draw(canvas)
    base_color = parse_color(style.dot_color.color)
    fallback_logo_color = parse_color(style.logo.logo_dot_color) if style.logo else base_color
    base_logo_scale = (
        eff_logo_scale
        if eff_logo_scale is not None
        else (style.logo.logo_dot_scale if style.logo else style.dot_scale)
    )

    for x, y in _data_modules(matrix):
        if has_silhouette and (x, y) in padding:
            continue
        if has_silhouette and (x, y) in silhouette:
            colour = colour_map.get((x, y), fallback_logo_color)
            scale = _edge_scale(coverage.get((x, y), 1.0), base_logo_scale, style.dot_scale)
            _draw_dot_raster(
                draw,
                (margin + x) * mod,
                (margin + y) * mod,
                mod,
                style.dot_shape,
                scale,
                colour,
            )
        else:
            _draw_dot_raster(
                draw,
                (margin + x) * mod,
                (margin + y) * mod,
                mod,
                style.dot_shape,
                style.dot_scale,
                base_color,
            )


def _edge_scale(coverage: float, logo_scale: float, base_scale: float) -> float:
    """Smooth-blend dot scale at a silhouette edge.

    Fully covered modules use ``logo_scale``; modules with partial coverage
    interpolate towards ``base_scale`` so the contour doesn't show a hard
    one-module jump. The coverage value is the fraction of sub-pixels under
    the logo mask.
    """
    if coverage >= 0.95:
        return logo_scale
    if coverage <= 0.5:
        return base_scale
    t = (coverage - 0.5) / 0.45
    return base_scale + (logo_scale - base_scale) * t


def _safe_get(matrix: list[list[bool]], x: int, y: int) -> bool:
    n = len(matrix)
    if 0 <= x < n and 0 <= y < n:
        return matrix[y][x]
    return False


def _paint_finders(
    canvas: Image.Image,
    n: int,
    mod: float,
    margin: int,
    style: StyleConfig,
) -> None:
    sq_color = parse_color(style.corner_square_color or first_stop_color(style.dot_color))
    dot_color = parse_color(style.corner_dot_color or first_stop_color(style.dot_color))
    hole_color = parse_color(
        style.background.color
        if (not is_transparent(style.background) and style.background.color)
        else "#FFFFFF"
    )
    draw = ImageDraw.Draw(canvas)
    for fx, fy in _finder_origins(n):
        _draw_finder_raster(
            draw,
            (margin + fx) * mod,
            (margin + fy) * mod,
            mod,
            style.corner_square_shape,
            style.corner_dot_shape,
            sq_color,
            dot_color,
            hole_color,
        )


def _draw_dot_raster(
    draw: ImageDraw.ImageDraw,
    px: float,
    py: float,
    mod: float,
    shape: str,
    scale: float,
    fill: tuple[int, int, int, int] | int,
) -> None:
    inset = mod * (1 - max(0.1, scale)) / 2
    box = (px + inset, py + inset, px + mod - inset, py + mod - inset)
    if shape == DotShape.DOTS.value:
        draw.ellipse(box, fill=fill)
    elif shape == DotShape.ROUNDED.value:
        draw.rounded_rectangle(box, radius=(mod - 2 * inset) * 0.3, fill=fill)
    elif shape == DotShape.EXTRA_ROUNDED.value:
        draw.rounded_rectangle(box, radius=(mod - 2 * inset) * 0.45, fill=fill)
    elif shape == DotShape.CLASSY.value:
        draw.rounded_rectangle(box, radius=(mod - 2 * inset) * 0.22, fill=fill)
    else:
        draw.rectangle(box, fill=fill)


def _draw_finder_raster(
    draw: ImageDraw.ImageDraw,
    px: float,
    py: float,
    mod: float,
    sq_shape: str,
    dot_shape: str,
    sq_color: tuple[int, int, int, int],
    dot_color: tuple[int, int, int, int],
    hole_color: tuple[int, int, int, int],
) -> None:
    s7 = 7 * mod
    s5 = 5 * mod
    s3 = 3 * mod
    outer_box = (px, py, px + s7, py + s7)
    hole_box = (px + mod, py + mod, px + mod + s5, py + mod + s5)
    inner_box = (px + 2 * mod, py + 2 * mod, px + 2 * mod + s3, py + 2 * mod + s3)

    if sq_shape == CornerSquareShape.DOT.value:
        draw.ellipse(outer_box, fill=sq_color)
        draw.ellipse(hole_box, fill=hole_color)
    elif sq_shape == CornerSquareShape.ROUNDED.value:
        draw.rounded_rectangle(outer_box, radius=s7 * 0.3, fill=sq_color)
        draw.rounded_rectangle(hole_box, radius=s5 * 0.3, fill=hole_color)
    else:
        draw.rectangle(outer_box, fill=sq_color)
        draw.rectangle(hole_box, fill=hole_color)

    if dot_shape == CornerDotShape.DOT.value:
        draw.ellipse(inner_box, fill=dot_color)
    else:
        draw.rectangle(inner_box, fill=dot_color)


def _draw_silhouette_border(
    canvas: Image.Image,
    silhouette: set[tuple[int, int]],
    padding: set[tuple[int, int]],
    mod: float,
    margin: int,
) -> None:
    box = silhouette_bounding_box(silhouette, padding)
    if box is None:
        return
    min_x, min_y, max_x, max_y = box
    px0 = (margin + min_x) * mod
    py0 = (margin + min_y) * mod
    px1 = (margin + max_x + 1) * mod
    py1 = (margin + max_y + 1) * mod
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((px0, py0, px1, py1), outline=(0, 0, 0, 200), width=max(1, int(mod / 4)))


def _encode_image(canvas: Image.Image, fmt: ImageFormat, style: StyleConfig) -> bytes:
    out = BytesIO()
    if fmt == "jpeg":
        if is_transparent(style.background):
            flat_bg = Image.new("RGBA", canvas.size, (255, 255, 255, 255))
            flat_bg.alpha_composite(canvas)
            flat_bg.convert("RGB").save(out, "JPEG", quality=92, optimize=True)
        else:
            canvas.convert("RGB").save(out, "JPEG", quality=92, optimize=True)
    elif fmt == "webp":
        canvas.save(out, "WEBP", quality=92, method=4)
    else:  # png
        canvas.save(out, "PNG", optimize=True)
    return out.getvalue()
