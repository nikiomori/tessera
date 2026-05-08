import { useContext } from 'react';

import { QRContext, type QRContextValue } from '@/context/qr-store';

export function useQR(): QRContextValue {
  const ctx = useContext(QRContext);
  if (!ctx) throw new Error('useQR must be used inside <QRProvider>');
  return ctx;
}
