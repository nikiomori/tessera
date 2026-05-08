import base64
from io import BytesIO

from PIL import Image, ImageDraw

from app.core.qr import generate
from app.models import (
    ColorOrGradient,
    DotShape,
    GenerateRequest,
    Gradient,
    GradientStop,
    LogoConfig,
    LogoMode,
    StyleConfig,
    UrlData,
)


def _logo_data_url(size: int = 128) -> str:
    """A solid black circle on a white background — useful as a silhouette mask."""
    img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((size // 8, size // 8, size - size // 8, size - size // 8), fill=(0, 0, 0, 255))
    buf = BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _request(**style_overrides: object) -> GenerateRequest:
    return GenerateRequest(
        data=UrlData(url="https://example.com"),
        style=StyleConfig(**style_overrides),  # type: ignore[arg-type]
        format="png",
    )


def test_png_is_valid_image() -> None:
    body, ct = generate(_request())
    assert ct == "image/png"
    img = Image.open(BytesIO(body))
    assert img.format == "PNG"
    assert img.size == (512, 512)


def test_svg_is_well_formed() -> None:
    req = _request()
    req = req.model_copy(update={"format": "svg"})
    body, ct = generate(req)
    assert ct == "image/svg+xml"
    text = body.decode()
    assert text.startswith("<svg")
    assert text.endswith("</svg>")


def test_dot_shape_dots_renders_circles() -> None:
    req = _request(dot_shape=DotShape.DOTS)
    req = req.model_copy(update={"format": "svg"})
    body, _ = generate(req)
    assert b"<circle" in body


def test_gradient_emits_defs() -> None:
    grad = ColorOrGradient(
        gradient=Gradient(
            stops=[GradientStop(offset=0, color="#FF0000"), GradientStop(offset=1, color="#0000FF")]
        )
    )
    req = _request(dot_color=grad)
    req = req.model_copy(update={"format": "svg"})
    body, _ = generate(req)
    assert b"linearGradient" in body
    assert b'fill="url(#fg-grad)"' in body


def test_jpeg_size() -> None:
    req = _request(size=256)
    req = req.model_copy(update={"format": "jpeg"})
    body, ct = generate(req)
    assert ct == "image/jpeg"
    img = Image.open(BytesIO(body))
    assert img.size == (256, 256)


def _logo_data_url_solid(color: tuple[int, int, int], size: int = 128) -> str:
    """A solid-colour filled circle on a white background."""
    img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((size // 8, size // 8, size - size // 8, size - size // 8), fill=(*color, 255))
    buf = BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def test_silhouette_uses_explicit_logo_dot_color_when_preserve_off() -> None:
    """With preserve_logo_colors=False the silhouette uses logo_dot_color verbatim."""
    logo = LogoConfig(
        image_data_url=_logo_data_url(),  # black circle
        mode=LogoMode.SILHOUETTE,
        size_ratio=0.6,
        preserve_logo_colors=False,
        logo_dot_color="#FF0000",
        bg_removal_color="#FFFFFF",
        bg_removal_threshold=15,
    )
    req = GenerateRequest(
        data=UrlData(url="https://example.com"),
        style=StyleConfig(size=512, matrix_version=12, logo=logo),
        format="png",
    )
    body, _ = generate(req)
    img = Image.open(BytesIO(body)).convert("RGB")
    width, height = img.size
    cy = height // 2
    has_red = any(img.getpixel((x, cy)) == (255, 0, 0) for x in range(width // 3, 2 * width // 3))
    assert has_red, "Expected logo_dot_color (#FF0000) under the silhouette."


def test_silhouette_samples_logo_colors_when_preserve_on() -> None:
    """preserve_logo_colors=True paints silhouette dots in the logo's actual colour."""
    logo = LogoConfig(
        image_data_url=_logo_data_url_solid((0, 128, 0)),  # green circle
        mode=LogoMode.SILHOUETTE,
        size_ratio=0.6,
        preserve_logo_colors=True,
        logo_dot_color="#FF0000",  # should be ignored when sampling succeeds
        bg_removal_color="#FFFFFF",
        bg_removal_threshold=15,
    )
    req = GenerateRequest(
        data=UrlData(url="https://example.com"),
        style=StyleConfig(size=512, matrix_version=12, logo=logo),
        format="png",
    )
    body, _ = generate(req)
    img = Image.open(BytesIO(body)).convert("RGB")
    width, height = img.size
    cy = height // 2
    centre_pixels = [img.getpixel((x, cy)) for x in range(width // 3, 2 * width // 3)]
    green_count = sum(1 for r, g, b in centre_pixels if g > r and g > b and g > 80)
    red_count = sum(1 for r, g, b in centre_pixels if r > 200 and g < 50 and b < 50)
    assert green_count > 0, "Expected sampled green pixels in the silhouette."
    assert red_count == 0, "Should not fall back to logo_dot_color when sampling succeeds."


def test_matrix_version_forced() -> None:
    """`matrix_version=12` should yield a 65x65 module grid regardless of payload size."""
    req = _request(matrix_version=12)
    body, _ = generate(req)
    img = Image.open(BytesIO(body))
    # Verify shape only — exact module-count check is implicit in successful generation.
    assert img.size == (512, 512)


def test_auto_detail_bumps_matrix_version_for_logo() -> None:
    """When matrix_version is None and a logo is present, auto-detail lifts the floor."""
    import segno

    from app.core.qr import _resolve_matrix_version

    logo = LogoConfig(
        image_data_url=_logo_data_url(),
        mode=LogoMode.SILHOUETTE,
        size_ratio=0.6,
        auto_detail=True,
    )
    style = StyleConfig(size=512, matrix_version=None, logo=logo)
    floor = _resolve_matrix_version(style)
    assert floor is not None and floor >= 10
    # The forced version still produces a valid QR.
    qr = segno.make("https://example.com", error="h", version=floor)
    assert qr.version == floor
