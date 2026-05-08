import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SectionProps {
  title: string;
  apiPath?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, apiPath, rightSlot, children, className }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-foreground text-[12px] font-medium uppercase tracking-[0.18em]">
            {title}
          </h2>
          {apiPath && <code className="field-key">{apiPath}</code>}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}

interface RowProps {
  label: string;
  apiKey?: string;
  hint?: string;
  children: ReactNode;
}

export function Row({ label, apiKey, hint, children }: RowProps) {
  return (
    <label className="group flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground/90 text-[12px]">{label}</span>
        {apiKey && (
          <code className="field-key opacity-0 transition-opacity group-hover:opacity-100">
            {apiKey}
          </code>
        )}
      </div>
      {children}
      {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
    </label>
  );
}
