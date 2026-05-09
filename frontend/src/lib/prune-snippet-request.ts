import { defaultLogo, defaultStyle } from './defaults';
import type { GenerateRequest, LogoConfig, StyleConfig } from '@/types/qr';

// Strip fields whose values match backend defaults so the API snippets shown
// in `ApiPanel` stay short. The actual request sent to /api/generate is
// untouched — pruning only affects the human-readable code sample.

const LOGO_SOURCE_KEYS = new Set(['image_data_url', 'image_url', 'site_url']);

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as object)) {
      const nv = normalize(val);
      if (nv !== undefined) out[k] = nv;
    }
    return out;
  }
  return v;
}

function strictEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const aa = a as unknown[];
    const bb = b as unknown[];
    if (aa.length !== bb.length) return false;
    return aa.every((v, i) => strictEqual(v, bb[i]));
  }
  const ak = Object.keys(a as object).sort();
  const bk = Object.keys(b as object).sort();
  if (ak.length !== bk.length) return false;
  if (ak.some((k, i) => k !== bk[i])) return false;
  return ak.every((k) =>
    strictEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

// Treat `null`/`undefined` keys as absent so e.g. `{ color: '#000', gradient: null }`
// equals the default `{ color: '#000' }`.
function looseEqual(a: unknown, b: unknown): boolean {
  return strictEqual(normalize(a), normalize(b));
}

function pruneLogo(logo: LogoConfig): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(logo)) {
    if (v === undefined) continue;
    if (LOGO_SOURCE_KEYS.has(k)) {
      if (v != null) out[k] = v;
      continue;
    }
    const def = (defaultLogo as Record<string, unknown>)[k];
    if (def === undefined) {
      out[k] = v;
      continue;
    }
    if (!looseEqual(v, def)) out[k] = v;
  }
  const hasSource =
    out.image_data_url != null || out.image_url != null || out.site_url != null;
  if (!hasSource && Object.keys(out).length === 0) return null;
  return out;
}

function pruneStyle(style: StyleConfig): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined) continue;
    if (k === 'logo') {
      if (!v) continue;
      const pruned = pruneLogo(v as LogoConfig);
      if (pruned) out.logo = pruned;
      continue;
    }
    const def = (defaultStyle as unknown as Record<string, unknown>)[k];
    if (def === undefined) {
      out[k] = v;
      continue;
    }
    if (!looseEqual(v, def)) out[k] = v;
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}

export function pruneSnippetRequest(req: GenerateRequest): Record<string, unknown> {
  const out: Record<string, unknown> = { data: req.data };
  const style = pruneStyle(req.style);
  if (style) out.style = style;
  if (req.format && req.format !== 'png') out.format = req.format;
  return out;
}
