import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';

import { initialRequest } from '@/lib/defaults';

import { QRContext, qrReducer, type LogoOrigin } from './qr-store';

export function QRProvider({ children }: { children: ReactNode }) {
  const [request, dispatch] = useReducer(qrReducer, initialRequest);
  const [logoOrigin, setLogoOrigin] = useState<LogoOrigin>(null);

  // Auto-clear origin when the logo is removed, so a stale 'auto-brand' tag
  // doesn't bleed into a fresh upload session.
  useEffect(() => {
    if (!request.style.logo) setLogoOrigin(null);
  }, [request.style.logo]);

  const value = useMemo(
    () => ({ request, dispatch, logoOrigin, setLogoOrigin }),
    [request, logoOrigin],
  );
  return <QRContext.Provider value={value}>{children}</QRContext.Provider>;
}
