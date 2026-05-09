import { Check, Copy, Terminal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { useQR } from '@/hooks/useQR';
import { pruneSnippetRequest } from '@/lib/prune-snippet-request';
import { cn } from '@/lib/utils';
import type { LogoOrigin } from '@/context/qr-store';
import type { GenerateRequest, LogoConfig } from '@/types/qr';

type Lang = 'curl' | 'fetch' | 'python';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'curl', label: 'curl' },
  { id: 'fetch', label: 'fetch' },
  { id: 'python', label: 'python' },
];

const HOST_HINT = '$HOST';

// Sentinel placeholder for `image_data_url`. The JSON body is built with this
// string and then post-processed per language into a variable reference, so
// snippets stay parameterisable instead of inlining ~50KB of base64.
const LOGO_PLACEHOLDER = '__TESSERA_LOGO_DATA_URL__';

type LogoSource =
  | { kind: 'none' }
  | { kind: 'file' }
  | { kind: 'url'; pageUrl: string };

function hasInlineLogo(req: GenerateRequest): boolean {
  return Boolean(req.style.logo?.image_data_url);
}

function withLogoPlaceholder(req: GenerateRequest): GenerateRequest {
  if (!req.style.logo?.image_data_url) return req;
  const logo: LogoConfig = { ...req.style.logo, image_data_url: LOGO_PLACEHOLDER };
  return { ...req, style: { ...req.style, logo } };
}

/**
 * Drop the inlined base64 and replace it with `site_url`. The backend's
 * /api/generate then auto-fetches the brand logo server-side, collapsing
 * the previous two-call flow (/logo-from-url + /generate) into one.
 */
function withSiteUrl(req: GenerateRequest, pageUrl: string): GenerateRequest {
  if (!req.style.logo) return req;
  // Strip image_data_url so the snippet doesn't show two redundant logo
  // sources side-by-side.
  const { image_data_url: _, ...rest } = req.style.logo;
  const next: LogoConfig = { ...rest, site_url: pageUrl };
  return { ...req, style: { ...req.style, logo: next } };
}

/**
 * Pick a snippet shape that mirrors how the user actually loaded the logo.
 * If origin is unknown but a logo is inlined (e.g. restored from history),
 * fall back to the file-load workflow since we have no URL to point at.
 */
function pickLogoSource(req: GenerateRequest, origin: LogoOrigin): LogoSource {
  if (!hasInlineLogo(req)) return { kind: 'none' };
  if (origin?.kind === 'auto-brand') return { kind: 'url', pageUrl: origin.pageUrl };
  return { kind: 'file' };
}

function formatJson(value: unknown, indent = 2, depth = 0): string {
  const pad = ' '.repeat(depth * indent);
  const padIn = ' '.repeat((depth + 1) * indent);
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((v) => padIn + formatJson(v, indent, depth + 1)).join(',\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([k, v]) => `${padIn}"${k}": ${formatJson(v, indent, depth + 1)}`)
      .join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
}

function codeForCurl(req: GenerateRequest, source: LogoSource): string {
  const json = formatJson(pruneSnippetRequest(withLogoPlaceholder(req)));
  const indented = (s: string) =>
    s
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n');

  if (source.kind === 'none') {
    return `curl -X POST ${HOST_HINT}/api/generate \\
  -H "Content-Type: application/json" \\
  --fail --output qr.png \\
  -d @- <<'JSON'
${indented(json)}
JSON`;
  }

  // Unquoted heredoc allows ${LOGO_DATA_URL} to expand. Escape any other `$`
  // chars first so they stay literal, then re-introduce the variable reference.
  const escaped = json
    .replace(/\$/g, '\\$')
    .replace(`"${LOGO_PLACEHOLDER}"`, '"${LOGO_DATA_URL}"');
  const body = indented(escaped);

  if (source.kind === 'file') {
    return `# 1 — encode logo.png on disk as a base64 data URL (portable: macOS + Linux)
LOGO_DATA_URL="data:image/png;base64,$(base64 < logo.png | tr -d '\\n')"

# 2 — generate the QR
curl -X POST ${HOST_HINT}/api/generate \\
  -H "Content-Type: application/json" \\
  --fail --output qr.png \\
  -d @- <<JSON
${body}
JSON`;
  }

  // source.kind === 'url' — single call: pass `site_url` and let the
  // backend auto-discover the favicon server-side.
  const siteJson = formatJson(pruneSnippetRequest(withSiteUrl(req, source.pageUrl)));
  return `curl -X POST ${HOST_HINT}/api/generate \\
  -H "Content-Type: application/json" \\
  --fail --output qr.png \\
  -d @- <<'JSON'
${indented(siteJson)}
JSON`;
}

function codeForFetch(req: GenerateRequest, source: LogoSource): string {
  const json = formatJson(pruneSnippetRequest(withLogoPlaceholder(req)), 2, 1);
  const bodyWithVar = json.replace(`"${LOGO_PLACEHOLDER}"`, 'dataUrl');

  if (source.kind === 'none') {
    return `const response = await fetch("${HOST_HINT}/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${json}),
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);`;
  }

  if (source.kind === 'file') {
    return `// 1 — read a local logo file (e.g. from <input type="file">) as a data URL
const file = /* File from <input type="file"> */;
const dataUrl: string = await new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = reject;
  r.readAsDataURL(file);
});

// 2 — generate the QR (dataUrl is dropped into style.logo.image_data_url)
const response = await fetch("${HOST_HINT}/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${bodyWithVar}),
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);`;
  }

  // Single call: pass `site_url` and let /api/generate auto-fetch the favicon.
  const siteJson = formatJson(pruneSnippetRequest(withSiteUrl(req, source.pageUrl)), 2, 1);
  return `const response = await fetch("${HOST_HINT}/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${siteJson}),
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);`;
}

function codeForPython(req: GenerateRequest, source: LogoSource): string {
  const json = formatJson(pruneSnippetRequest(withLogoPlaceholder(req)), 4, 1);
  const bodyWithVar = json.replace(`"${LOGO_PLACEHOLDER}"`, 'data_url');

  if (source.kind === 'none') {
    return `import requests

response = requests.post(
    "${HOST_HINT}/api/generate",
    json=${json},
)
response.raise_for_status()
with open("qr.png", "wb") as f:
    f.write(response.content)`;
  }

  if (source.kind === 'file') {
    return `import base64, pathlib, requests

# 1 — encode the local logo file as a base64 data URL
logo_b64 = base64.b64encode(pathlib.Path("logo.png").read_bytes()).decode()
data_url = f"data:image/png;base64,{logo_b64}"

# 2 — generate the QR
response = requests.post(
    "${HOST_HINT}/api/generate",
    json=${bodyWithVar},
)
response.raise_for_status()
pathlib.Path("qr.png").write_bytes(response.content)`;
  }

  // Single call: pass `site_url` and let /api/generate auto-fetch the favicon.
  const siteJson = formatJson(pruneSnippetRequest(withSiteUrl(req, source.pageUrl)), 4, 1);
  return `import requests

response = requests.post(
    "${HOST_HINT}/api/generate",
    json=${siteJson},
)
response.raise_for_status()
with open("qr.png", "wb") as f:
    f.write(response.content)`;
}

function highlight(code: string, lang: Lang): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  // JSON string + key
  const stringRe = /"((?:\\.|[^"\\])*)"/g;
  // Numbers
  const numRe = /\b-?\d+\.?\d*\b/g;
  // Comments (Python/JS shell)
  const commentRe = lang === 'python' ? /#.*/g : lang === 'curl' ? /^#.*$/gm : /\/\/.*/g;

  // Naive line-by-line tokenizer
  for (const line of code.split('\n')) {
    const fragments: ReactNode[] = [];
    let cursor = 0;
    type Mark = { start: number; end: number; cls: string; text: string };
    const marks: Mark[] = [];

    line.replace(stringRe, (m, _g, offset) => {
      const isKey = line.slice(offset + m.length).trimStart().startsWith(':');
      marks.push({
        start: offset,
        end: offset + m.length,
        cls: isKey ? 'text-accent' : 'text-foreground/85',
        text: m,
      });
      return m;
    });
    line.replace(numRe, (m, offset) => {
      // skip numbers inside strings already marked
      if (marks.some((mk) => offset >= mk.start && offset < mk.end)) return m;
      marks.push({
        start: offset,
        end: offset + m.length,
        cls: 'text-[color:var(--color-success)]',
        text: m,
      });
      return m;
    });
    line.replace(commentRe, (m, offset) => {
      if (marks.some((mk) => offset >= mk.start && offset < mk.end)) return m;
      marks.push({
        start: offset,
        end: offset + m.length,
        cls: 'text-muted-foreground italic',
        text: m,
      });
      return m;
    });

    marks.sort((a, b) => a.start - b.start);
    for (const m of marks) {
      if (m.start > cursor) {
        fragments.push(line.slice(cursor, m.start));
      }
      fragments.push(
        <span key={++key} className={m.cls}>
          {m.text}
        </span>,
      );
      cursor = m.end;
    }
    if (cursor < line.length) fragments.push(line.slice(cursor));

    out.push(
      <span key={++key} className="block whitespace-pre">
        {fragments.length > 0 ? fragments : line || ' '}
      </span>,
    );
  }
  return out;
}

function sourceLabel(source: LogoSource): string {
  if (source.kind === 'none') return 'no logo';
  if (source.kind === 'file') return 'logo: local file';
  return `logo: site_url · ${source.pageUrl}`;
}

export function ApiPanel() {
  const { request, logoOrigin } = useQR();
  const [lang, setLang] = useState<Lang>('curl');
  const [copied, setCopied] = useState(false);

  const source = useMemo(() => pickLogoSource(request, logoOrigin), [request, logoOrigin]);

  const code = useMemo(() => {
    if (lang === 'curl') return codeForCurl(request, source);
    if (lang === 'fetch') return codeForFetch(request, source);
    return codeForPython(request, source);
  }, [lang, request, source]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        code.replace(new RegExp(`\\${HOST_HINT}`, 'g'), window.location.origin),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="panel flex h-full flex-col">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="text-accent h-3 w-3" />
          <span className="text-foreground text-[12px] font-medium uppercase tracking-[0.18em]">
            API call
          </span>
          <code className="field-key">live</code>
        </div>
        <div className="flex items-center gap-0.5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={cn(
                'rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
                lang === l.id
                  ? 'text-accent bg-accent-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <span className="text-muted-foreground truncate font-mono text-[11px]">
          {sourceLabel(source)}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] transition-colors',
            copied
              ? 'text-[color:var(--color-success)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>

      <pre className="flex-1 overflow-auto px-4 py-4 font-mono text-[12px] leading-[1.7]">
        <code className="text-foreground/80">{highlight(code, lang)}</code>
      </pre>

      <div className="border-border text-muted-foreground border-t px-4 py-2 font-mono text-[10px] tracking-wider uppercase">
        host: <span className="text-foreground/70">{window.location.origin}</span>
      </div>
    </div>
  );
}
