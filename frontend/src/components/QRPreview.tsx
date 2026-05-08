import { Loader2 } from 'lucide-react';

import { useQR } from '@/hooks/useQR';
import { useQRImage } from '@/hooks/useQRImage';
import { cn } from '@/lib/utils';

export function QRPreview() {
  const { request } = useQR();
  const previewRequest = { ...request, format: 'png' as const };
  const { url, isLoading, error } = useQRImage(previewRequest);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="border-border bg-surface-1 relative w-full max-w-[420px] rounded-xl border p-3">
        <div
          className={cn(
            'bg-white relative aspect-square overflow-hidden rounded-md transition-opacity',
            isLoading && url && 'opacity-80',
          )}
        >
          {url ? (
            <img src={url} alt="QR code preview" className="h-full w-full object-contain" />
          ) : isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm">
              Configure to preview
            </div>
          )}
          {isLoading && url && (
            <div className="bg-background/85 text-muted-foreground absolute right-2 bottom-2 flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] backdrop-blur">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> rendering
            </div>
          )}
        </div>
      </div>

      <div className="text-muted-foreground flex w-full max-w-[420px] items-center justify-between font-mono text-[10px] uppercase tracking-wider">
        <span>
          v{request.style.matrix_version ?? 'auto'}
          <span className="opacity-50"> · </span>
          ec.{request.style.error_correction.toLowerCase()}
        </span>
        <span>{request.style.size}px</span>
      </div>

      {error && (
        <p className="text-[color:var(--color-danger)] mt-1 max-w-[420px] text-[12px]">
          {error}
        </p>
      )}
    </div>
  );
}
