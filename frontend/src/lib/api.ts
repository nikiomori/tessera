import type { BatchRequest, GenerateRequest, Preset } from '@/types/qr';

const apiKey = import.meta.env.VITE_API_KEY as string | undefined;

function headers(json: boolean = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (apiKey) h['X-API-Key'] = apiKey;
  return h;
}

async function failOnError(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = response.statusText;
  try {
    const body = await response.json();
    if (body?.detail) message = String(body.detail);
  } catch {
    // ignore
  }
  throw new Error(`${response.status}: ${message}`);
}

export async function generateQR(req: GenerateRequest): Promise<Blob> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(req),
  });
  await failOnError(response);
  return response.blob();
}

export async function generateBatch(req: BatchRequest): Promise<Blob> {
  const response = await fetch('/api/batch', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(req),
  });
  await failOnError(response);
  return response.blob();
}

export async function fetchPresets(): Promise<Preset[]> {
  const response = await fetch('/api/presets', { headers: headers(false) });
  await failOnError(response);
  return response.json() as Promise<Preset[]>;
}

export interface LogoFromUrlResponse {
  image_data_url: string;
  source: string;
  width: number | null;
  height: number | null;
}

export async function fetchLogoFromUrl(url: string): Promise<LogoFromUrlResponse> {
  const response = await fetch('/api/logo-from-url', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ url }),
  });
  await failOnError(response);
  return response.json() as Promise<LogoFromUrlResponse>;
}

export function quickQrUrl(params: {
  data: string;
  size?: number;
  fg?: string;
  bg?: string;
  ec?: 'L' | 'M' | 'Q' | 'H';
  format?: 'png' | 'svg' | 'jpeg' | 'webp';
}): string {
  const sp = new URLSearchParams();
  sp.set('data', params.data);
  if (params.size) sp.set('size', String(params.size));
  if (params.fg) sp.set('fg', params.fg);
  if (params.bg) sp.set('bg', params.bg);
  if (params.ec) sp.set('ec', params.ec);
  if (params.format) sp.set('format', params.format);
  return `/api/generate?${sp.toString()}`;
}
