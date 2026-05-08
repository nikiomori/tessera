"""Built-in style presets exposed at GET /api/presets."""

from __future__ import annotations

from app.models import (
    ColorOrGradient,
    CornerDotShape,
    CornerSquareShape,
    DotShape,
    Gradient,
    GradientStop,
    Preset,
    StyleConfig,
)


def _solid(color: str) -> ColorOrGradient:
    return ColorOrGradient(color=color)


def _gradient(
    stops: list[tuple[float, str]], rotation: float = 45, kind: str = "linear"
) -> ColorOrGradient:
    return ColorOrGradient(
        gradient=Gradient(
            type=kind,  # type: ignore[arg-type]
            rotation=rotation,
            stops=[GradientStop(offset=o, color=c) for o, c in stops],
        )
    )


PRESETS: list[Preset] = [
    Preset(
        id="classic",
        name="Classic",
        description="Black on white, square dots — universally readable.",
        style=StyleConfig(),
    ),
    Preset(
        id="rounded-mono",
        name="Rounded Mono",
        description="Soft rounded squares for a modern feel.",
        style=StyleConfig(
            dot_shape=DotShape.ROUNDED,
            corner_square_shape=CornerSquareShape.ROUNDED,
            corner_dot_shape=CornerDotShape.DOT,
        ),
    ),
    Preset(
        id="dotted",
        name="Dotted",
        description="Circular dots for a playful look.",
        style=StyleConfig(
            dot_shape=DotShape.DOTS,
            corner_square_shape=CornerSquareShape.DOT,
            corner_dot_shape=CornerDotShape.DOT,
        ),
    ),
    Preset(
        id="vivid-gradient",
        name="Vivid Gradient",
        description="Magenta-to-orange linear gradient.",
        style=StyleConfig(
            dot_shape=DotShape.EXTRA_ROUNDED,
            corner_square_shape=CornerSquareShape.ROUNDED,
            corner_dot_shape=CornerDotShape.DOT,
            dot_color=_gradient([(0, "#FF008C"), (1, "#FF8A00")], rotation=45),
        ),
    ),
    Preset(
        id="ocean",
        name="Ocean",
        description="Deep blue radial gradient.",
        style=StyleConfig(
            dot_shape=DotShape.ROUNDED,
            corner_square_shape=CornerSquareShape.ROUNDED,
            corner_dot_shape=CornerDotShape.DOT,
            dot_color=_gradient([(0, "#0EA5E9"), (1, "#1E3A8A")], kind="radial"),
        ),
    ),
    Preset(
        id="forest",
        name="Forest",
        description="Earthy green tones, soft rounding.",
        style=StyleConfig(
            dot_shape=DotShape.ROUNDED,
            corner_square_shape=CornerSquareShape.ROUNDED,
            corner_dot_shape=CornerDotShape.SQUARE,
            dot_color=_solid("#15803D"),
            corner_square_color="#0F4C2D",
        ),
    ),
    Preset(
        id="sunset",
        name="Sunset",
        description="Warm sunset gradient on cream background.",
        style=StyleConfig(
            dot_shape=DotShape.DOTS,
            corner_square_shape=CornerSquareShape.DOT,
            corner_dot_shape=CornerDotShape.DOT,
            dot_color=_gradient([(0, "#F97316"), (1, "#DC2626")], rotation=90),
            background=_solid("#FFF7ED"),
        ),
    ),
    Preset(
        id="midnight",
        name="Midnight",
        description="Light dots on near-black background.",
        style=StyleConfig(
            dot_shape=DotShape.ROUNDED,
            corner_square_shape=CornerSquareShape.ROUNDED,
            corner_dot_shape=CornerDotShape.DOT,
            dot_color=_solid("#F8FAFC"),
            background=_solid("#0F172A"),
            corner_square_color="#38BDF8",
            corner_dot_color="#F8FAFC",
        ),
    ),
    Preset(
        id="mint",
        name="Mint",
        description="Pastel mint green with soft corners.",
        style=StyleConfig(
            dot_shape=DotShape.ROUNDED,
            corner_square_shape=CornerSquareShape.ROUNDED,
            corner_dot_shape=CornerDotShape.DOT,
            dot_color=_solid("#0F766E"),
            background=_solid("#ECFDF5"),
        ),
    ),
    Preset(
        id="paper",
        name="Paper",
        description="Subtle warm paper background, classy dots.",
        style=StyleConfig(
            dot_shape=DotShape.CLASSY,
            corner_square_shape=CornerSquareShape.SQUARE,
            corner_dot_shape=CornerDotShape.SQUARE,
            dot_color=_solid("#1F2937"),
            background=_solid("#FAF7F0"),
        ),
    ),
    Preset(
        id="neon",
        name="Neon",
        description="Cyan-to-violet gradient on near-black.",
        style=StyleConfig(
            dot_shape=DotShape.DOTS,
            corner_square_shape=CornerSquareShape.DOT,
            corner_dot_shape=CornerDotShape.DOT,
            dot_color=_gradient([(0, "#22D3EE"), (1, "#A855F7")], rotation=135),
            background=_solid("#0B1020"),
        ),
    ),
    Preset(
        id="print-ready",
        name="Print Ready",
        description="High-contrast B&W, big margin — best for print.",
        style=StyleConfig(
            dot_shape=DotShape.SQUARE,
            corner_square_shape=CornerSquareShape.SQUARE,
            corner_dot_shape=CornerDotShape.SQUARE,
            margin=8,
            error_correction="H",
        ),
    ),
]


def find_preset(preset_id: str) -> Preset | None:
    for p in PRESETS:
        if p.id == preset_id:
            return p
    return None
