import { Bookmark, Copy, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useQR } from '@/hooks/useQR';
import { useToaster } from '@/hooks/useToaster';
import { generateQR } from '@/lib/api';
import { pushHistory } from '@/lib/storage';
import { blobToDataUrl, cn, downloadBlob } from '@/lib/utils';
import type { ImageFormat } from '@/types/qr';

const FORMATS: { value: ImageFormat; label: string; ext: string }[] = [
  { value: 'png', label: 'PNG', ext: 'png' },
  { value: 'svg', label: 'SVG', ext: 'svg' },
  { value: 'jpeg', label: 'JPEG', ext: 'jpg' },
  { value: 'webp', label: 'WebP', ext: 'webp' },
];

function describe(req: ReturnType<typeof useQR>['request']): string {
  const d = req.data;
  switch (d.kind) {
    case 'url':
      return d.url || 'URL';
    case 'text':
      return d.text.slice(0, 40);
    case 'wifi':
      return `Wi-Fi · ${d.ssid}`;
    case 'vcard':
      return `${d.first_name} ${d.last_name}`.trim();
    case 'email':
      return `Email · ${d.to}`;
    case 'sms':
      return `SMS · ${d.to}`;
    case 'phone':
      return `Phone · ${d.number}`;
    case 'geo':
      return `Geo · ${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}`;
    case 'event':
      return `Event · ${d.title}`;
  }
}

export function ExportPanel() {
  const { request, dispatch } = useQR();
  const { push } = useToaster();
  const [busy, setBusy] = useState<'download' | 'copy' | 'save' | null>(null);

  async function handleDownload(): Promise<void> {
    setBusy('download');
    try {
      const blob = await generateQR(request);
      const ext = FORMATS.find((f) => f.value === request.format)?.ext ?? 'png';
      const slug =
        describe(request)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) || 'qr';
      downloadBlob(blob, `${slug}.${ext}`);
      push('Saved file', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy(): Promise<void> {
    if (!('ClipboardItem' in window)) {
      push('Clipboard image copy not supported.', 'error');
      return;
    }
    setBusy('copy');
    try {
      const blob = await generateQR({ ...request, format: 'png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      push('Copied PNG to clipboard', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Copy failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(): Promise<void> {
    setBusy('save');
    try {
      const thumb = await generateQR({
        ...request,
        format: 'png',
        style: { ...request.style, size: 192, logo: request.style.logo },
      });
      pushHistory({
        request,
        thumbnail: await blobToDataUrl(thumb),
        label: describe(request),
      });
      push('Saved to history', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="label-meta">format</span>
        <div className="flex gap-1">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => dispatch({ type: 'set-format', format: f.value })}
              className={cn(
                'rounded font-mono text-[11px] uppercase tracking-wide transition-colors',
                'px-2.5 py-1',
                request.format === f.value
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className="btn-accent inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {busy === 'download' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download {request.format.toUpperCase()}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy !== null}
          className="btn-ghost inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {busy === 'copy' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          Copy PNG
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="btn-ghost inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {busy === 'save' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Bookmark className="h-3 w-3" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}
