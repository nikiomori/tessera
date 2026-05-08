import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useQR } from '@/hooks/useQR';
import { clearHistory, loadHistory, removeHistory, type HistoryItem } from '@/lib/storage';

export function HistoryPanel() {
  const { dispatch } = useQR();
  const [items, setItems] = useState<HistoryItem[]>([]);

  function refresh(): void {
    setItems(loadHistory());
  }

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-[12px] leading-relaxed">
        Empty. Click <kbd className="bg-muted text-foreground/85 rounded px-1.5 py-0.5 font-mono text-[10px]">Save</kbd>{' '}
        in the export panel to remember a QR.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <code className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
          {items.length} item{items.length === 1 ? '' : 's'}
        </code>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            refresh();
          }}
          className="text-muted-foreground hover:text-[color:var(--color-danger)] font-mono text-[10px] uppercase tracking-wider"
        >
          Clear
        </button>
      </div>

      <ul className="-mx-1 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
        {items.map((it) => (
          <li
            key={it.id}
            className="border-border bg-surface-2/40 hover:border-accent/50 flex items-center gap-2.5 rounded border px-2 py-1.5 transition-colors"
          >
            <img src={it.thumbnail} alt="" className="bg-white border-border h-9 w-9 shrink-0 rounded border" />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => dispatch({ type: 'replace', request: it.request })}
            >
              <p className="text-foreground/90 truncate text-[12px]">{it.label}</p>
              <p className="text-muted-foreground font-mono text-[10px]">
                {new Date(it.created_at).toLocaleDateString()} ·{' '}
                {new Date(it.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                removeHistory(it.id);
                refresh();
              }}
              className="text-muted-foreground hover:bg-muted hover:text-[color:var(--color-danger)] inline-flex h-6 w-6 items-center justify-center rounded transition-colors"
              aria-label="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
