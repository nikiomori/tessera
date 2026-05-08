import { useEffect, useState } from 'react';

import { useQR } from '@/hooks/useQR';
import { useToaster } from '@/hooks/useToaster';
import { fetchPresets, quickQrUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Preset } from '@/types/qr';

export function TemplatesGallery() {
  const { dispatch } = useQR();
  const { push } = useToaster();
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets()
      .then(setPresets)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  if (error) return <p className="text-[color:var(--color-danger)] text-sm">{error}</p>;
  if (!presets) return <p className="text-muted-foreground text-sm">Loading templates…</p>;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            dispatch({ type: 'apply-style', style: p.style });
            push(`Applied · ${p.name}`, 'success');
          }}
          className={cn(
            'border-border bg-surface-2/40 hover:border-accent group flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors',
          )}
        >
          <div className="bg-white border-border aspect-square overflow-hidden rounded border">
            <img
              src={quickQrUrl({
                data: 'https://example.com',
                size: 256,
                fg: p.style.dot_color.color ?? p.style.dot_color.gradient?.stops[0]?.color ?? '#000000',
                bg: p.style.background.color ?? '#FFFFFF',
                format: 'svg',
              })}
              alt=""
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
          <div>
            <p className="text-foreground text-[11px] font-medium">{p.name}</p>
            <p className="text-muted-foreground line-clamp-2 text-[10px] leading-tight">{p.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
