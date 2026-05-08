"""Logo decoding, background removal, and silhouette computation.

Two image sources are supported:

* ``image_data_url`` — embedded ``data:image/...;base64,...`` URL (preferred).
* ``image_url`` — HTTP(S) URL fetched server-side with strict size/host guards.

The module exposes:

* :func:`load_logo_image` — decode bytes into a Pillow RGBA image.
* :func:`prepare_silhouette_data` — apply background removal and downsample
  to the QR module grid; returns ``(alpha_mask, coloured_image)``.
* :func:`silhouette_modules` — turn the alpha mask into ``(silhouette, padding,
  coverage)`` sets of ``(x, y)`` module coordinates.
* :func:`sample_silhouette_colors` — for each silhouette module, the RGBA
  colour at that spot in the original logo (used for multi-colour rendering).
* :func:`fetch_logo_for_site` — auto-discovery of brand icons by URL
  (apple-touch-icon → favicon → og:image → Google S2).
"""

from __future__ import annotations

import base64
import contextlib
import ipaddress
import math
import re
import socket
from html.parser import HTMLParser
from io import BytesIO
from typing import cast
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from PIL import Image

from app.models import BgRemovalMethod, LogoConfig

from .colors import parse_color

_RGBA = tuple[int, int, int, int]

MAX_LOGO_BYTES = 4 * 1024 * 1024
ALLOWED_SCHEMES = {"http", "https"}
FETCH_TIMEOUT = 5.0


def _decode_data_url(data_url: str) -> bytes:
    if not data_url.startswith("data:"):
        raise ValueError("Logo data URL must start with 'data:'.")
    header, _, body = data_url.partition(",")
    if not body:
        raise ValueError("Empty data URL body.")
    if ";base64" in header:
        return base64.b64decode(body, validate=True)
    raise ValueError("Only base64-encoded data URLs are supported.")


def _is_public_address(host: str) -> bool:
    """Block loopback / private / link-local hosts to mitigate SSRF."""
    try:
        addrs = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except socket.gaierror:
        return False
    for raw in addrs:
        ip = ipaddress.ip_address(raw)
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
            return False
    return True


def _fetch_url(url: str) -> bytes:
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Unsupported scheme: {parsed.scheme!r}.")
    if not parsed.hostname:
        raise ValueError("URL has no hostname.")
    if not _is_public_address(parsed.hostname):
        raise ValueError("Refusing to fetch private/loopback address.")

    request = Request(url, headers={"User-Agent": "tessera/0.1"})
    with urlopen(request, timeout=FETCH_TIMEOUT) as response:
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_LOGO_BYTES:
            raise ValueError("Remote logo exceeds 4 MB limit.")
        chunks: list[bytes] = []
        total = 0
        for chunk in iter(lambda: response.read(64 * 1024), b""):
            total += len(chunk)
            if total > MAX_LOGO_BYTES:
                raise ValueError("Remote logo exceeds 4 MB limit.")
            chunks.append(chunk)
        return b"".join(chunks)


def load_logo_image(logo: LogoConfig) -> Image.Image:
    if logo.image_data_url:
        raw = _decode_data_url(logo.image_data_url)
    elif logo.image_url:
        raw = _fetch_url(logo.image_url)
    elif logo.site_url:
        # Auto-discover the brand logo for a website URL — same routine as
        # POST /api/logo-from-url. Re-encoded to PNG so the downstream open()
        # always succeeds.
        raw, _, _ = fetch_logo_for_site(logo.site_url)
    else:
        raise ValueError("Logo config requires image_data_url, image_url, or site_url.")
    if len(raw) > MAX_LOGO_BYTES:
        raise ValueError("Logo exceeds 4 MB limit.")
    try:
        return Image.open(BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        raise ValueError("Logo image is not a recognisable format. Try PNG, JPG, or WebP.") from exc


def _color_distance_squared(a: _RGBA, b: _RGBA) -> int:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def remove_background_by_color(
    image: Image.Image,
    target: _RGBA,
    threshold_pct: int,
) -> Image.Image:
    """Return a copy of ``image`` with pixels close to ``target`` made fully transparent.

    ``threshold_pct`` is 0-100. 0 = exact match only; 100 = remove everything.
    The threshold is interpreted as a percentage of the maximum possible
    Euclidean distance in RGB space (~441).
    """
    img = image.convert("RGBA").copy()
    max_distance = math.sqrt(255**2 * 3)
    cutoff = (threshold_pct / 100) * max_distance
    cutoff_sq = int(cutoff * cutoff)

    pixels = img.load()
    assert pixels is not None
    width, height = img.size
    for y in range(height):
        for x in range(width):
            px = cast(_RGBA, pixels[x, y])
            if _color_distance_squared(px, target) <= cutoff_sq:
                pixels[x, y] = (px[0], px[1], px[2], 0)
    return img


def prepare_silhouette_data(
    logo: LogoConfig,
    logo_modules: int,
    subpixel: int = 1,
) -> tuple[Image.Image, Image.Image]:
    """Return ``(mask, coloured)`` images.

    * ``mask`` — ``L``-mode image at ``logo_modules * subpixel`` resolution;
      values > 128 mark "logo silhouette". A higher ``subpixel`` means each
      module is sampled across a larger sub-grid — used to compute coverage
      fractions and reproduce smoother silhouette edges.
    * ``coloured`` — ``RGBA`` image at ``logo_modules`` resolution; the
      renderer samples it pixel-by-pixel when ``preserve_logo_colors`` is on.
    """
    raw = load_logo_image(logo)

    # Working size scales with the silhouette resolution we eventually need.
    target_side = max(64, logo_modules * max(subpixel, 1) * 4)
    work_side = min(768, target_side)
    raw.thumbnail((work_side, work_side), Image.Resampling.LANCZOS)

    if logo.bg_removal_method == BgRemovalMethod.COLOR:
        target = parse_color(logo.bg_removal_color)
        raw = remove_background_by_color(raw, target, logo.bg_removal_threshold)

    # Square-pad so the silhouette is centred regardless of input aspect ratio.
    side = max(raw.width, raw.height)
    centred = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    centred.paste(raw, ((side - raw.width) // 2, (side - raw.height) // 2), raw)

    coloured = centred.resize((logo_modules, logo_modules), Image.Resampling.LANCZOS)
    if subpixel > 1:
        hi = centred.resize(
            (logo_modules * subpixel, logo_modules * subpixel),
            Image.Resampling.LANCZOS,
        )
        mask = hi.split()[3]
    else:
        mask = coloured.split()[3]
    return mask, coloured


def silhouette_modules(
    mask: Image.Image,
    matrix_size: int,
    space_around: int,
    subpixel: int = 1,
) -> tuple[
    set[tuple[int, int]],
    set[tuple[int, int]],
    dict[tuple[int, int], float],
]:
    """Return ``(silhouette, padding_ring, coverage)``.

    The mask may be at sub-module resolution (``subpixel > 1``). For each
    module we average the alpha of its ``subpixel x subpixel`` block:

    * coverage > 0.5 → silhouette
    * coverage 0..1 → recorded in the ``coverage`` dict so the renderer can
      shrink edge dots proportionally for smoother contours.

    ``padding_ring`` is the ``space_around``-thick dilation of the silhouette
    minus the silhouette itself.
    """
    sub = max(1, subpixel)
    logo_modules = mask.width // sub
    offset = (matrix_size - logo_modules) // 2
    pixels = mask.load()
    assert pixels is not None

    silhouette: set[tuple[int, int]] = set()
    coverage: dict[tuple[int, int], float] = {}
    block_area = sub * sub
    threshold = 128
    for my in range(logo_modules):
        for mx in range(logo_modules):
            covered = 0
            for sy in range(sub):
                py = my * sub + sy
                for sx in range(sub):
                    if cast(int, pixels[mx * sub + sx, py]) > threshold:
                        covered += 1
            if covered == 0:
                continue
            ratio = covered / block_area
            module_xy = (offset + mx, offset + my)
            coverage[module_xy] = ratio
            if ratio >= 0.5:
                silhouette.add(module_xy)

    padding: set[tuple[int, int]] = set()
    if space_around > 0 and silhouette:
        for x, y in silhouette:
            for dx in range(-space_around, space_around + 1):
                for dy in range(-space_around, space_around + 1):
                    candidate = (x + dx, y + dy)
                    if candidate not in silhouette:
                        padding.add(candidate)

    return silhouette, padding, coverage


def silhouette_bounding_box(
    silhouette: set[tuple[int, int]],
    padding: set[tuple[int, int]],
) -> tuple[int, int, int, int] | None:
    """Module-grid bounding box ``(min_x, min_y, max_x, max_y)`` of silhouette+padding."""
    region = silhouette | padding
    if not region:
        return None
    xs = [p[0] for p in region]
    ys = [p[1] for p in region]
    return (min(xs), min(ys), max(xs), max(ys))


def mean_silhouette_color(
    coloured: Image.Image,
    silhouette: set[tuple[int, int]],
    matrix_size: int,
) -> _RGBA | None:
    """Average opaque RGB across the silhouette modules, weighted by alpha.

    Used by the auto-contrast heuristic: when the dominant colour of the
    logo's silhouette is too close to the QR's dot colour, the renderer can
    bump padding/scale to keep the silhouette readable. Returns ``None`` if
    no opaque pixels are visible.
    """
    logo_modules = coloured.width
    offset = (matrix_size - logo_modules) // 2
    pixels = coloured.load()
    if pixels is None:
        return None
    total = 0
    sum_r = sum_g = sum_b = 0
    for x, y in silhouette:
        lx = x - offset
        ly = y - offset
        if 0 <= lx < logo_modules and 0 <= ly < logo_modules:
            r, g, b, a = cast(_RGBA, pixels[lx, ly])
            if a < 32:
                continue
            sum_r += r
            sum_g += g
            sum_b += b
            total += 1
    if total == 0:
        return None
    return (sum_r // total, sum_g // total, sum_b // total, 255)


def sample_silhouette_colors(
    coloured: Image.Image,
    silhouette: set[tuple[int, int]],
    matrix_size: int,
) -> dict[tuple[int, int], _RGBA]:
    """For each silhouette module, sample its RGBA colour from ``coloured``.

    Pixels with low alpha (i.e. modules that fell on the removed background)
    are skipped. The renderer treats missing entries as "use the explicit
    ``logo_dot_color`` fallback".
    """
    logo_modules = coloured.width
    offset = (matrix_size - logo_modules) // 2
    pixels = coloured.load()
    assert pixels is not None
    result: dict[tuple[int, int], _RGBA] = {}
    for x, y in silhouette:
        lx = x - offset
        ly = y - offset
        if 0 <= lx < logo_modules and 0 <= ly < logo_modules:
            r, g, b, a = cast(_RGBA, pixels[lx, ly])
            if a < 32:
                continue
            # Force fully opaque so JPEG/WebP encoding stays predictable.
            result[(x, y)] = (r, g, b, 255)
    return result


class _IconParser(HTMLParser):
    """Pull `<link rel='icon|...'>` and `<meta property='og:image'>` candidates."""

    def __init__(self) -> None:
        super().__init__()
        self.candidates: list[tuple[str, str, int]] = []  # (rel, href, score)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag == "link":
            rel = attr.get("rel", "").lower()
            href = attr.get("href", "")
            if not href:
                return
            # Square brand icons score higher than og:image banners.
            score = 0
            if "apple-touch-icon" in rel:
                score = 200
            elif "shortcut icon" in rel or rel == "icon":
                score = 100
            elif "mask-icon" in rel:
                score = 50
            else:
                return
            sizes = attr.get("sizes", "")
            m = re.match(r"(\d+)x(\d+)", sizes)
            if m:
                score += int(m.group(1))
            self.candidates.append((rel, href, score))
        elif tag == "meta":
            prop = (attr.get("property") or attr.get("name") or "").lower()
            # og:image / twitter:image are usually wide social banners, only used
            # when no proper icon is found. Score them below the smallest icon.
            if prop in {"og:image", "twitter:image"}:
                content = attr.get("content", "")
                if content:
                    self.candidates.append((prop, content, 30))


def fetch_logo_for_site(site_url: str) -> tuple[bytes, str, str]:
    """Try to find and return the brand logo for a website.

    Returns ``(image_bytes, content_type, source_label)``.
    """
    if "://" in site_url:
        # Reject unknown schemes (ftp:, file:, javascript:, ...) up-front so we
        # never prepend `https://` in front of garbage like `ftp://example.com`.
        scheme = site_url.split("://", 1)[0].lower()
        if scheme not in ALLOWED_SCHEMES:
            raise ValueError(f"Invalid URL scheme: {scheme!r}.")
    else:
        site_url = "https://" + site_url

    parsed = urlparse(site_url)
    if parsed.scheme not in ALLOWED_SCHEMES or not parsed.hostname:
        raise ValueError("Invalid URL.")
    if not _is_public_address(parsed.hostname):
        raise ValueError("Refusing to fetch private/loopback address.")

    base = f"{parsed.scheme}://{parsed.netloc}/"

    # Step 1: parse HTML for icon links and og:image
    try:
        html_bytes = _fetch_url(site_url)
    except Exception:
        html_bytes = b""

    parser = _IconParser()
    if html_bytes:
        with contextlib.suppress(Exception):
            parser.feed(html_bytes.decode("utf-8", errors="replace"))

    # Collect (score, url, label) entries from HTML, plus always-on fallbacks.
    scored: list[tuple[int, str, str]] = []
    for rel, href, score in parser.candidates:
        absolute = urljoin(site_url, href)
        if absolute.lower().endswith(".svg"):
            # Pillow can't render SVG; skip.
            continue
        scored.append((score, absolute, rel))

    # /favicon.ico is the de-facto convention — square brand icon, almost always
    # better than og:image. Score it above the og:image floor (30) but below
    # apple-touch-icon (200) and explicit <link rel=icon> entries (100).
    scored.append((90, urljoin(base, "/favicon.ico"), "favicon"))

    # Google's S2 favicon proxy — last resort, but reliable. Returns a square PNG.
    scored.append(
        (
            10,
            f"https://www.google.com/s2/favicons?domain={parsed.hostname}&sz=128",
            "google-s2",
        )
    )

    # Highest-score candidates first.
    scored.sort(key=lambda c: -c[0])
    candidates_abs: list[tuple[str, str]] = [(url, label) for _, url, label in scored]

    seen: set[str] = set()
    last_error: str | None = None
    for url, label in candidates_abs:
        if url in seen:
            continue
        seen.add(url)
        try:
            data = _fetch_url(url)
            if not data:
                continue
            content_type = _sniff_content_type(data, url)
            if content_type.startswith("image/svg"):
                continue
            png_bytes = _normalise_to_png(data)
            if png_bytes is None:
                last_error = f"{label}: not a recognisable raster image"
                continue
            return png_bytes, "image/png", label
        except Exception as exc:
            last_error = f"{label}: {exc}"
            continue

    raise ValueError(
        f"Could not find a usable logo for {site_url!r}."
        + (f" Last error: {last_error}" if last_error else "")
    )


def _normalise_to_png(data: bytes) -> bytes | None:
    """Decode arbitrary image bytes (PNG/JPEG/WebP/ICO/GIF/...) and re-encode as PNG.

    Returns ``None`` when Pillow cannot identify the image. Pillow's default
    behaviour for ICO already selects the largest sub-image, so we don't need
    to crawl frames manually. The PNG re-encode also drops format quirks that
    trip up later loads.
    """
    try:
        opened = Image.open(BytesIO(data))
        opened.load()
    except Exception:
        return None
    if opened.format is None:
        return None
    img: Image.Image = opened.convert("RGBA") if opened.mode != "RGBA" else opened
    buf = BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def _sniff_content_type(data: bytes, url: str) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:4] == b"\x00\x00\x01\x00" or data[:4] == b"\x00\x00\x02\x00":
        return "image/x-icon"
    if url.lower().endswith(".ico"):
        return "image/x-icon"
    return "application/octet-stream"
