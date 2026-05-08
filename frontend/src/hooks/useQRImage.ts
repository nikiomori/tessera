import { useEffect, useMemo, useRef, useState } from 'react';

import { generateQR } from '@/lib/api';
import type { GenerateRequest } from '@/types/qr';

import { useDebouncedValue } from './useDebouncedValue';

interface QRImageState {
  url: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Debounces the request and fetches the rendered image as a blob URL.
 *
 * The dependency tracked through the debounce is a JSON of the request, not
 * the object reference. Callers can pass a freshly-built object every render
 * (e.g. `{...request, format: 'png'}`) without triggering an infinite fetch
 * loop — the effect only re-runs when the request *content* changes.
 */
export function useQRImage(request: GenerateRequest, debounceMs = 200): QRImageState {
  const requestKey = useMemo(() => JSON.stringify(request), [request]);
  const debouncedKey = useDebouncedValue(requestKey, debounceMs);

  const [state, setState] = useState<QRImageState>({
    url: null,
    isLoading: false,
    error: null,
  });
  const lastUrlRef = useRef<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const token = ++tokenRef.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const parsed = JSON.parse(debouncedKey) as GenerateRequest;
    generateQR(parsed)
      .then((blob) => {
        if (tokenRef.current !== token) return;
        const url = URL.createObjectURL(blob);
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = url;
        setState({ url, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (tokenRef.current !== token) return;
        setState({
          url: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Generation failed',
        });
      });
  }, [debouncedKey]);

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  return state;
}
