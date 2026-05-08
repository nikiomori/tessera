import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useQR } from '@/hooks/useQR';
import { useToaster } from '@/hooks/useToaster';
import { fetchLogoFromUrl } from '@/lib/api';
import { dataKindLabels, defaultLogo } from '@/lib/defaults';
import { cn } from '@/lib/utils';
import type { DataKind, UrlData } from '@/types/qr';

const SECONDARY_KINDS: DataKind[] = ['text', 'wifi', 'vcard', 'email', 'sms', 'phone', 'geo', 'event'];

export function Hero() {
  const { request, dispatch, setLogoOrigin } = useQR();
  const { push } = useToaster();
  const [busy, setBusy] = useState(false);

  const isUrl = request.data.kind === 'url';
  const urlValue = isUrl ? (request.data as UrlData).url : '';

  function switchTo(kind: DataKind) {
    dispatch({ type: 'set-data-kind', kind });
  }

  async function handleFetch() {
    if (!urlValue) {
      push('Paste a URL first.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetchLogoFromUrl(urlValue);
      const existing = request.style.logo;
      dispatch({
        type: 'set-logo',
        logo: {
          ...defaultLogo,
          ...(existing ?? {}),
          image_data_url: res.image_data_url,
          mode: existing?.mode ?? 'silhouette',
          preserve_logo_colors: existing?.preserve_logo_colors ?? true,
        },
      });
      setLogoOrigin({ kind: 'auto-brand', pageUrl: urlValue });
      push(`Brand fetched · ${res.source}`, 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not fetch logo', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-6 pt-8 pb-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <h1 className="font-display text-foreground text-[26px] font-[700] leading-tight tracking-tight md:text-[32px]">
              Paste a URL. <span className="text-accent">Get a branded QR.</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
              Auto-fetches the site's logo and paints it directly into the QR pattern.
            </p>
          </div>

          <div className="md:col-span-7 flex flex-col gap-2">
            {isUrl ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlValue}
                  placeholder="https://your-brand.com"
                  onChange={(e) => dispatch({ type: 'patch-data', patch: { url: e.target.value } })}
                  className="input-flat flex-1"
                />
                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={busy || !urlValue}
                  className="btn-accent inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Auto-brand
                </button>
              </div>
            ) : (
              <KindSwitchedBanner
                kind={request.data.kind}
                onBack={() => switchTo('url')}
              />
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="label-meta">{isUrl ? 'or use' : 'switch to'}</span>
              {SECONDARY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => switchTo(k)}
                  className={cn(
                    'text-[12px] transition-colors',
                    request.data.kind === k
                      ? 'text-accent'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {dataKindLabels[k].toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KindSwitchedBanner({ kind, onBack }: { kind: DataKind; onBack: () => void }) {
  return (
    <div className="border-border bg-surface-1/60 flex items-center gap-3 rounded-md border px-3 py-2.5">
      <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
        encoding
      </span>
      <code className="text-accent font-mono text-[13px]">{dataKindLabels[kind]}</code>
      <span className="text-muted-foreground flex-1 text-[12px]">
        Edit the fields in the <span className="text-foreground/85">Data</span> section below.
      </span>
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider transition-colors"
      >
        <ArrowUp className="h-3 w-3" /> URL
      </button>
    </div>
  );
}
