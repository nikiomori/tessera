import { useContext } from 'react';

import { ToasterContext, type ToasterContextValue } from '@/context/toaster-store';

export function useToaster(): ToasterContextValue {
  const ctx = useContext(ToasterContext);
  if (!ctx) throw new Error('useToaster must be used inside <ToasterProvider>');
  return ctx;
}
