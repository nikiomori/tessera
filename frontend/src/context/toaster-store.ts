import { createContext } from 'react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToasterContextValue {
  push: (message: string, variant?: ToastVariant) => void;
}

export const ToasterContext = createContext<ToasterContextValue | null>(null);
