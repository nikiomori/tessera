import { useQR } from '@/hooks/useQR';
import { cn } from '@/lib/utils';
import type {
  ColorOrGradient,
  CornerDotShape,
  CornerSquareShape,
  DotShape,
  ErrorCorrection,
  Gradient,
} from '@/types/qr';

import { Row } from './Section';

const DOT_SHAPES: { value: DotShape; label: string; symbol: string }[] = [
  { value: 'square', label: 'Square', symbol: '▣' },
  { value: 'rounded', label: 'Rounded', symbol: '▢' },
  { value: 'extra-rounded', label: 'Soft', symbol: '◌' },
  { value: 'classy', label: 'Classy', symbol: '▤' },
  { value: 'dots', label: 'Dots', symbol: '●' },
];
const CORNER_SQUARE: { value: CornerSquareShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dot', label: 'Dot' },
];
const CORNER_DOT: { value: CornerDotShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Dot' },
];
const EC_LEVELS: { value: ErrorCorrection; label: string }[] = [
  { value: 'L', label: 'L · 7%' },
  { value: 'M', label: 'M · 15%' },
  { value: 'Q', label: 'Q · 25%' },
  { value: 'H', label: 'H · 30%' },
];

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  renderSymbol,
}: {
  options: { value: T; label: string; symbol?: string }[];
  value: T;
  onChange: (v: T) => void;
  renderSymbol?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors',
            value === opt.value
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-border hover:border-accent/50 hover:bg-muted text-foreground/80',
          )}
        >
          {renderSymbol && opt.symbol && <span className="font-sans text-[13px] leading-none">{opt.symbol}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded border px-2 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors',
        active
          ? 'border-accent bg-accent text-accent-foreground'
          : 'border-border hover:border-accent/50 hover:bg-muted text-foreground/80',
      )}
    >
      {children}
    </button>
  );
}

function ColorOrGradientControl({
  value,
  onChange,
  allowTransparent = false,
}: {
  value: ColorOrGradient;
  onChange: (next: ColorOrGradient) => void;
  allowTransparent?: boolean;
}) {
  const mode: 'solid' | 'gradient' | 'transparent' = value.gradient
    ? 'gradient'
    : value.color === 'transparent'
      ? 'transparent'
      : 'solid';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <ModeButton active={mode === 'solid'} onClick={() => onChange({ color: '#000000' })}>
          Solid
        </ModeButton>
        <ModeButton
          active={mode === 'gradient'}
          onClick={() =>
            onChange({
              gradient: {
                type: 'linear',
                rotation: 45,
                stops: [
                  { offset: 0, color: '#FF008C' },
                  { offset: 1, color: '#FF8A00' },
                ],
              },
            })
          }
        >
          Gradient
        </ModeButton>
        {allowTransparent && (
          <ModeButton active={mode === 'transparent'} onClick={() => onChange({ color: 'transparent' })}>
            None
          </ModeButton>
        )}
      </div>

      {mode === 'solid' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value.color ?? '#000000'}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 w-12 cursor-pointer"
          />
          <code className="text-muted-foreground flex-1 font-mono text-[11px]">{value.color}</code>
        </div>
      )}

      {mode === 'gradient' && value.gradient && (
        <GradientEditor gradient={value.gradient} onChange={(g) => onChange({ gradient: g })} />
      )}
    </div>
  );
}

function GradientEditor({
  gradient,
  onChange,
}: {
  gradient: Gradient;
  onChange: (next: Gradient) => void;
}) {
  return (
    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded border p-2">
      <div className="flex gap-1">
        <ModeButton active={gradient.type === 'linear'} onClick={() => onChange({ ...gradient, type: 'linear' })}>
          Linear
        </ModeButton>
        <ModeButton active={gradient.type === 'radial'} onClick={() => onChange({ ...gradient, type: 'radial' })}>
          Radial
        </ModeButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {gradient.stops.map((stop, i) => (
          <label key={i} className="flex flex-col gap-1">
            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
              stop · {Math.round(stop.offset * 100)}%
            </span>
            <input
              type="color"
              value={stop.color}
              onChange={(e) => {
                const next = [...gradient.stops];
                next[i] = { ...stop, color: e.target.value };
                onChange({ ...gradient, stops: next });
              }}
              className="h-8 w-full cursor-pointer"
            />
          </label>
        ))}
      </div>
      {gradient.type === 'linear' && (
        <label className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">rotation</span>
            <code className="text-foreground font-mono text-[11px]">{gradient.rotation}°</code>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={gradient.rotation}
            onChange={(e) => onChange({ ...gradient, rotation: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}

function ValueRange({
  label,
  apiKey,
  display,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  apiKey?: string;
  display: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={label} apiKey={apiKey}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">{display}</code>
      </div>
    </Row>
  );
}

export function StyleControls() {
  const { request, dispatch } = useQR();
  const s = request.style;

  return (
    <div className="flex flex-col gap-5">
      <Row label="Dot shape" apiKey="dot_shape">
        <ChipRow
          options={DOT_SHAPES}
          value={s.dot_shape}
          onChange={(v) => dispatch({ type: 'set-dot-shape', value: v })}
          renderSymbol
        />
      </Row>

      <ValueRange
        label="Dot scale"
        apiKey="dot_scale"
        display={`${Math.round(s.dot_scale * 100)}%`}
        min={20}
        max={150}
        value={Math.round(s.dot_scale * 100)}
        onChange={(v) => dispatch({ type: 'patch-style', patch: { dot_scale: v / 100 } })}
      />

      <Row label="Corner squares" apiKey="corner_square_shape">
        <ChipRow
          options={CORNER_SQUARE}
          value={s.corner_square_shape}
          onChange={(v) => dispatch({ type: 'set-corner-square', shape: v })}
        />
        <label className="text-muted-foreground mt-1 flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={s.corner_square_color != null}
            onChange={(e) =>
              dispatch({
                type: 'set-corner-square',
                color: e.target.checked ? (s.dot_color.color ?? '#000000') : null,
              })
            }
          />
          Override colour
          {s.corner_square_color != null && (
            <input
              type="color"
              value={s.corner_square_color}
              onChange={(e) => dispatch({ type: 'set-corner-square', color: e.target.value })}
              className="ml-auto h-6 w-10 cursor-pointer"
            />
          )}
        </label>
      </Row>

      <Row label="Corner dots" apiKey="corner_dot_shape">
        <ChipRow
          options={CORNER_DOT}
          value={s.corner_dot_shape}
          onChange={(v) => dispatch({ type: 'set-corner-dot', shape: v })}
        />
      </Row>

      <Row label="Foreground" apiKey="dot_color">
        <ColorOrGradientControl
          value={s.dot_color}
          onChange={(v) => dispatch({ type: 'set-dot-color', value: v })}
        />
      </Row>

      <Row label="Background" apiKey="background">
        <ColorOrGradientControl
          value={s.background}
          onChange={(v) => dispatch({ type: 'set-background', value: v })}
          allowTransparent
        />
      </Row>

      <Row
        label="Matrix version"
        apiKey="matrix_version"
        hint="Higher = more modules — needed for detailed logos. Auto picks the smallest that fits the data."
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={40}
            value={s.matrix_version ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              dispatch({
                type: 'patch-style',
                patch: { matrix_version: v === 0 ? null : v },
              });
            }}
            className="flex-1"
          />
          <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">
            {s.matrix_version == null ? 'auto' : `V${s.matrix_version}`}
          </code>
        </div>
      </Row>

      <ValueRange
        label="Output size"
        apiKey="size"
        display={`${s.size}px`}
        min={128}
        max={2048}
        step={32}
        value={s.size}
        onChange={(v) => dispatch({ type: 'set-size', value: v })}
      />

      <ValueRange
        label="Margin"
        apiKey="margin"
        display={`${s.margin}`}
        min={0}
        max={20}
        value={s.margin}
        onChange={(v) => dispatch({ type: 'set-margin', value: v })}
      />

      <Row label="Error correction" apiKey="error_correction">
        <ChipRow
          options={EC_LEVELS}
          value={s.error_correction}
          onChange={(v) => dispatch({ type: 'set-error-correction', value: v })}
        />
      </Row>
    </div>
  );
}
