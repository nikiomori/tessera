import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ToasterContext, type ToastVariant } from './toaster-store';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

let nextId = 1;

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = nextId++;
    setToasts((curr) => [...curr, { id, message, variant }]);
    setTimeout(() => setToasts((curr) => curr.filter((t) => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-md px-4 py-3 text-sm shadow-lg backdrop-blur',
              t.variant === 'success' && 'bg-emerald-600/95 text-white',
              t.variant === 'error' && 'bg-red-600/95 text-white',
              t.variant === 'info' && 'bg-slate-800/95 text-slate-100',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
}
