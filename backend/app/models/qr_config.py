"""Pydantic v2 schemas for QR generation requests and style configuration."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# --- Data payload (discriminated union by `kind`) ----------------------------


class WifiAuth(StrEnum):
    WPA = "WPA"
    WEP = "WEP"
    NOPASS = "nopass"


class UrlData(BaseModel):
    kind: Literal["url"] = "url"
    url: Annotated[str, Field(min_length=1, max_length=4296)]


class TextData(BaseModel):
    kind: Literal["text"] = "text"
    text: Annotated[str, Field(min_length=1, max_length=4296)]


class WifiData(BaseModel):
    kind: Literal["wifi"] = "wifi"
    ssid: Annotated[str, Field(min_length=1, max_length=32)]
    password: str = ""
    encryption: WifiAuth = WifiAuth.WPA
    hidden: bool = False


class VCardData(BaseModel):
    kind: Literal["vcard"] = "vcard"
    first_name: Annotated[str, Field(min_length=1, max_length=64)]
    last_name: str = ""
    org: str | None = None
    title_role: str | None = None
    phone: str | None = None
    email: str | None = None
    url: str | None = None
    address: str | None = None


class EmailData(BaseModel):
    kind: Literal["email"] = "email"
    to: Annotated[str, Field(min_length=3, max_length=320)]
    subject: str | None = None
    body: str | None = None


class SmsData(BaseModel):
    kind: Literal["sms"] = "sms"
    to: Annotated[str, Field(min_length=1, max_length=32)]
    message: str | None = None


class PhoneData(BaseModel):
    kind: Literal["phone"] = "phone"
    number: Annotated[str, Field(min_length=1, max_length=32)]


class GeoData(BaseModel):
    kind: Literal["geo"] = "geo"
    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]


class EventData(BaseModel):
    kind: Literal["event"] = "event"
    title: Annotated[str, Field(min_length=1, max_length=200)]
    start: Annotated[str, Field(description="ISO 8601 timestamp, e.g. 2026-05-10T14:00:00")]
    end: Annotated[str, Field(description="ISO 8601 timestamp")]
    location: str | None = None
    description: str | None = None


DataPayload = Annotated[
    UrlData
    | TextData
    | WifiData
    | VCardData
    | EmailData
    | SmsData
    | PhoneData
    | GeoData
    | EventData,
    Field(discriminator="kind"),
]


# --- Style ------------------------------------------------------------------

ErrorCorrection = Literal["L", "M", "Q", "H"]
ImageFormat = Literal["png", "svg", "jpeg", "webp"]


class GradientStop(BaseModel):
    offset: Annotated[float, Field(ge=0, le=1)]
    color: Annotated[str, Field(pattern=r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")]


class Gradient(BaseModel):
    type: Literal["linear", "radial"] = "linear"
    rotation: Annotated[float, Field(ge=0, le=360)] = 0
    stops: Annotated[list[GradientStop], Field(min_length=2, max_length=8)]


class ColorOrGradient(BaseModel):
    color: str | None = Field(
        default=None,
        pattern=r"^(#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent)$",
    )
    gradient: Gradient | None = None


class DotShape(StrEnum):
    SQUARE = "square"
    ROUNDED = "rounded"
    DOTS = "dots"
    EXTRA_ROUNDED = "extra-rounded"
    CLASSY = "classy"


class CornerSquareShape(StrEnum):
    SQUARE = "square"
    ROUNDED = "rounded"
    DOT = "dot"


class CornerDotShape(StrEnum):
    SQUARE = "square"
    DOT = "dot"


class BgRemovalMethod(StrEnum):
    NONE = "none"
    COLOR = "color"


class LogoMode(StrEnum):
    """How the logo affects rendering.

    Only one mode is supported: the logo's non-background pixels form a
    *mask*; modules that fall inside the mask are drawn with the logo dot
    colour and scale, modules outside are drawn with the regular dot
    settings. The logo becomes part of the QR pattern itself.
    """

    SILHOUETTE = "silhouette"


class LogoConfig(BaseModel):
    """Logo embedded into the QR code as a silhouette mask (see `LogoMode`)."""

    image_data_url: str | None = Field(
        default=None,
        description="data:image/...;base64,... URL with the logo image bytes.",
    )
    image_url: str | None = Field(
        default=None,
        description="Optional public HTTP(S) URL to fetch the logo from.",
    )
    site_url: str | None = Field(
        default=None,
        description=(
            "Optional public HTTP(S) URL of a *website* (not an image). "
            "When set, the renderer auto-discovers the brand logo "
            "(apple-touch-icon → favicon → og:image → Google S2) — same "
            "logic as POST /api/logo-from-url, but inline so a QR can be "
            "generated in a single request."
        ),
    )
    mode: LogoMode = LogoMode.SILHOUETTE
    size_ratio: Annotated[float, Field(ge=0.05, le=0.95)] = 0.6

    # Silhouette-mode settings
    logo_dot_color: str = Field(
        default="#000000",
        pattern=r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
        description="Fallback colour when `preserve_logo_colors=False`.",
    )
    preserve_logo_colors: bool = Field(
        default=True,
        description=(
            "If true, each silhouette module is painted with the colour sampled "
            "from the original logo at that position (gives a multi-colour brand "
            "look). If false, all silhouette modules use `logo_dot_color`."
        ),
    )
    logo_dot_scale: Annotated[float, Field(ge=0.1, le=1.5)] = 1.0
    space_around: Annotated[int, Field(ge=0, le=4)] = 1
    draw_border: bool = False

    # Detail / contrast (silhouette + solid modes)
    subpixel: Annotated[int, Field(ge=1, le=5)] = Field(
        default=3,
        description=(
            "How many sub-pixels per QR module to sample when computing the "
            "logo silhouette. Higher = smoother, more detailed silhouette edges. "
            "1 = legacy behaviour (binary nearest-pixel sampling)."
        ),
    )
    auto_contrast: bool = Field(
        default=True,
        description=(
            "Automatically widen the padding ring when the logo's effective "
            "colour is too close to the QR dot colour, so the silhouette stays "
            "visible without manual tuning."
        ),
    )
    auto_detail: bool = Field(
        default=True,
        description=(
            "Automatically lift the QR matrix version floor when a logo is "
            "present and `matrix_version` is not explicitly set, giving the "
            "silhouette more modules to work with."
        ),
    )

    # Logo pre-processing (silhouette mode)
    bg_removal_method: BgRemovalMethod = BgRemovalMethod.COLOR
    bg_removal_color: str = Field(
        default="#FFFFFF",
        pattern=r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
        description="Colour to remove from the logo background.",
    )
    bg_removal_threshold: Annotated[int, Field(ge=0, le=100)] = 15


class StyleConfig(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    size: Annotated[int, Field(ge=128, le=4096)] = 512
    margin: Annotated[int, Field(ge=0, le=20)] = 4
    error_correction: ErrorCorrection = "M"
    matrix_version: int | None = Field(
        default=None,
        ge=1,
        le=40,
        description="Force a specific QR version (1-40). None = auto-pick smallest.",
    )
    dot_shape: DotShape = DotShape.SQUARE
    dot_scale: Annotated[float, Field(ge=0.1, le=1.5)] = 1.0
    dot_color: ColorOrGradient = Field(default_factory=lambda: ColorOrGradient(color="#000000"))
    background: ColorOrGradient = Field(default_factory=lambda: ColorOrGradient(color="#FFFFFF"))
    corner_square_shape: CornerSquareShape = CornerSquareShape.SQUARE
    corner_square_color: str | None = None
    corner_dot_shape: CornerDotShape = CornerDotShape.SQUARE
    corner_dot_color: str | None = None
    logo: LogoConfig | None = None


# --- Requests ----------------------------------------------------------------


class GenerateRequest(BaseModel):
    data: DataPayload
    style: StyleConfig = Field(default_factory=StyleConfig)
    format: ImageFormat = "png"


class BatchItem(BaseModel):
    name: str | None = Field(
        default=None, description="Filename inside the resulting ZIP (without extension)."
    )
    request: GenerateRequest


class BatchRequest(BaseModel):
    items: Annotated[list[BatchItem], Field(min_length=1, max_length=10_000)]


# --- Built-in presets exposed via /api/presets ------------------------------


class Preset(BaseModel):
    id: str
    name: str
    description: str | None = None
    style: StyleConfig


# --- Logo auto-fetch endpoint ------------------------------------------------


class LogoFromUrlRequest(BaseModel):
    url: Annotated[str, Field(min_length=4, max_length=2048)]


class LogoFromUrlResponse(BaseModel):
    image_data_url: str
    source: str = Field(
        description="Where the logo came from: favicon, apple-touch-icon, og:image, …"
    )
    width: int | None = None
    height: int | None = None
