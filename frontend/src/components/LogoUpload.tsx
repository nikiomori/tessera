import { Sparkles, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, type DragEvent } from 'react';

import { useQR } from '@/hooks/useQR';
import { useToaster } from '@/hooks/useToaster';
import { defaultLogo } from '@/lib/defaults';
import { cn, fileToDataUrl } from '@/lib/utils';
import type { BgRemovalMethod, LogoConfig } from '@/types/qr';

import { Row } from './Section';

const ACCEPT = 'image/png, image/jpeg, image/webp, image/svg+xml';

export function LogoUpload() {
  const { request, dispatch, setLogoOrigin } = useQR();
  const { push } = useToaster();
  const logo = request.style.logo;

  function update(patch: Partial<LogoConfig>): void {
    if (!logo) return;
    dispatch({ type: 'set-logo', logo: { ...logo, ...patch } });
  }

  async function handleFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      push('Please select an image file.', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      push('Image is too large (max 4 MB).', 'error');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    dispatch({
      type: 'set-logo',
      logo: { ...defaultLogo, ...(logo ?? {}), image_data_url: dataUrl },
    });
    setLogoOrigin({ kind: 'file' });
  }

  function onChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  if (!logo?.image_data_url) {
    return (
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-border hover:border-accent hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors"
      >
        <div className="bg-accent/10 text-accent flex h-12 w-12 items-center justify-center rounded-full">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <p className="text-foreground text-sm font-medium">Drop a logo</p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            PNG · JPG · WebP · SVG · up to 4 MB
          </p>
        </div>
        <p className="text-muted-foreground inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
          <Sparkles className="text-accent h-3 w-3" />
          or use Auto-brand above
        </p>
        <input type="file" accept={ACCEPT} className="hidden" onChange={onChange} />
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-surface-2/40 flex items-center gap-3 rounded-lg border p-3">
        <div className="border-border bg-white/95 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border">
          <img src={logo.image_data_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-[13px] font-medium">Logo loaded</p>
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
            {Math.round(logo.size_ratio * 100)}% · {logo.preserve_logo_colors ? 'multi' : 'mono'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'set-logo', logo: null })}
          className="text-muted-foreground hover:bg-muted hover:text-[color:var(--color-danger)] inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
          aria-label="Remove logo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Row label="Size" apiKey="logo.size_ratio">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={90}
            value={Math.round(logo.size_ratio * 100)}
            onChange={(e) => update({ size_ratio: Number(e.target.value) / 100 })}
            className="flex-1"
          />
          <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">
            {Math.round(logo.size_ratio * 100)}%
          </code>
        </div>
      </Row>

      <SilhouetteControls logo={logo} update={update} />
    </div>
  );
}

function SilhouetteControls({
  logo,
  update,
}: {
  logo: LogoConfig;
  update: (patch: Partial<LogoConfig>) => void;
}) {
  return (
    <>
      <Row label="Logo dot colour" apiKey="logo.preserve_logo_colors">
        <label className="border-border bg-muted/30 flex items-center gap-2 rounded border p-2 text-[12px]">
          <input
            type="checkbox"
            checked={logo.preserve_logo_colors}
            onChange={(e) => update({ preserve_logo_colors: e.target.checked })}
            className="mt-0.5"
          />
          <div className="flex-1">
            <p className="text-foreground font-medium">Sample from the logo</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
              Each module is painted with the colour at that spot in the original logo — gives a multi-colour brand look.
            </p>
          </div>
        </label>
        {!logo.preserve_logo_colors && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={logo.logo_dot_color}
              onChange={(e) => update({ logo_dot_color: e.target.value })}
              className="h-8 w-12 cursor-pointer"
            />
            <code className="text-muted-foreground font-mono text-[11px]">{logo.logo_dot_color}</code>
          </div>
        )}
      </Row>

      <Row label="Logo dot scale" apiKey="logo.logo_dot_scale">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={20}
            max={100}
            value={Math.round(logo.logo_dot_scale * 100)}
            onChange={(e) => update({ logo_dot_scale: Number(e.target.value) / 100 })}
            className="flex-1"
          />
          <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">
            {Math.round(logo.logo_dot_scale * 100)}%
          </code>
        </div>
      </Row>

      <Row label="Spacing around logo" apiKey="logo.space_around">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={3}
            value={logo.space_around}
            onChange={(e) => update({ space_around: Number(e.target.value) })}
            className="flex-1"
          />
          <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">
            {logo.space_around}m
          </code>
        </div>
      </Row>

      <Row
        label="Edge detail"
        apiKey="logo.subpixel"
        hint="Sub-pixel sampling for the silhouette. Higher = smoother edges."
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            value={logo.subpixel ?? 3}
            onChange={(e) => update({ subpixel: Number(e.target.value) })}
            className="flex-1"
          />
          <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">
            {logo.subpixel ?? 3}×
          </code>
        </div>
      </Row>

      <div className="-mt-2 flex flex-col gap-2">
        <label className="text-foreground/85 flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={logo.draw_border}
            onChange={(e) => update({ draw_border: e.target.checked })}
          />
          Draw outline around silhouette
        </label>
        <label className="text-foreground/85 flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={logo.auto_contrast ?? true}
            onChange={(e) => update({ auto_contrast: e.target.checked })}
          />
          Auto-contrast for dark logos
        </label>
        <label className="text-foreground/85 flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={logo.auto_detail ?? true}
            onChange={(e) => update({ auto_detail: e.target.checked })}
          />
          Auto-bump matrix density for detail
        </label>
      </div>

      <Row
        label="Background removal"
        apiKey="logo.bg_removal_method"
        hint="Eats away the chosen colour from the logo so only the brand mark remains."
      >
        <div className="grid grid-cols-2 gap-1">
          {(['color', 'none'] as BgRemovalMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ bg_removal_method: m })}
              className={cn(
                'rounded border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors',
                logo.bg_removal_method === m
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border hover:border-accent/50 hover:bg-muted text-foreground/80',
              )}
            >
              {m === 'color' ? 'By colour' : 'None'}
            </button>
          ))}
        </div>
        {logo.bg_removal_method === 'color' && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={logo.bg_removal_color}
                onChange={(e) => update({ bg_removal_color: e.target.value })}
                className="h-8 w-12 cursor-pointer"
              />
              <code className="text-muted-foreground font-mono text-[11px]">{logo.bg_removal_color}</code>
              <span className="text-muted-foreground text-[11px]">target</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                value={logo.bg_removal_threshold}
                onChange={(e) => update({ bg_removal_threshold: Number(e.target.value) })}
                className="flex-1"
              />
              <code className="text-foreground/90 w-14 text-right font-mono text-[11px]">
                ±{logo.bg_removal_threshold}%
              </code>
            </div>
          </div>
        )}
      </Row>
    </>
  );
}

