import { Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { useQR } from '@/hooks/useQR';
import { useToaster } from '@/hooks/useToaster';
import { generateBatch } from '@/lib/api';
import { cn, downloadBlob } from '@/lib/utils';
import type { BatchItem, ImageFormat } from '@/types/qr';

const FORMATS: ImageFormat[] = ['png', 'svg', 'jpeg', 'webp'];

interface BatchDialogProps {
  open: boolean;
  onClose: () => void;
}

function parseLines(input: string): { name?: string; data: string }[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    if (line.includes(',')) {
      const [name, ...rest] = line.split(',');
      return { name: name.trim(), data: rest.join(',').trim() };
    }
    return { data: line };
  });
}

export function BatchDialog({ open, onClose }: BatchDialogProps) {
  const { request } = useQR();
  const { push } = useToaster();
  const [text, setText] = useState(
    'home, https://example.com\nabout, https://example.com/about\ncontact, https://example.com/contact',
  );
  const [format, setFormat] = useState<ImageFormat>('png');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleGenerate(): Promise<void> {
    const parsed = parseLines(text);
    if (parsed.length === 0) {
      push('Add at least one line.', 'error');
      return;
    }
    setBusy(true);
    try {
      const items: BatchItem[] = parsed.map((p, i) => ({
        name: p.name ?? `qr_${String(i + 1).padStart(3, '0')}`,
        request: { ...request, format, data: { kind: 'url', url: p.data } },
      }));
      const blob = await generateBatch({ items });
      downloadBlob(blob, 'qr-codes.zip');
      push(`Generated ${items.length} QRs`, 'success');
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Batch failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="panel glow-accent w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="font-display text-foreground text-[20px] font-[700] leading-none tracking-tight">
              Generate many QRs at once
            </h2>
            <p className="text-muted-foreground mt-1 text-[12px]">
              One per line · use{' '}
              <code className="text-foreground/85 font-mono text-[11px]">name, url</code> to pick filenames · current style applies to all
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <textarea
            className="border-border bg-surface-1 focus:border-accent h-56 w-full rounded-md border px-3 py-2 font-mono text-[12px] focus:outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="label-meta">format</span>
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  'rounded px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors',
                  format === f
                    ? 'bg-accent text-accent-foreground'
                    : 'border-border hover:border-accent/50 hover:bg-muted text-foreground/80 border',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="border-border flex items-center justify-between gap-2 border-t px-5 py-3">
          <code className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
            POST /api/batch
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost rounded-md px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className="btn-accent inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate ZIP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
