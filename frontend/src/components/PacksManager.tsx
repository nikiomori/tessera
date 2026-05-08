import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';

import { useQR } from '@/hooks/useQR';
import { useToaster } from '@/hooks/useToaster';
import { generateBatch } from '@/lib/api';
import {
  createPack,
  deletePack,
  exportPack,
  importPack,
  loadPacks,
  updatePack,
  type Pack,
} from '@/lib/storage';
import { cn, downloadBlob } from '@/lib/utils';

export function PacksManager() {
  const { request } = useQR();
  const { push } = useToaster();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [name, setName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  function refresh(): void {
    setPacks(loadPacks());
  }

  useEffect(refresh, []);

  function handleCreate(): void {
    if (!name.trim()) return;
    createPack(name.trim());
    setName('');
    refresh();
  }

  function handleAddCurrent(packId: string): void {
    updatePack(packId, (p) => ({
      ...p,
      items: [...p.items, { id: nanoid(8), label: describeLabel(request), request }],
    }));
    refresh();
    push('Added current QR to pack', 'success');
  }

  function handleRemoveItem(packId: string, itemId: string): void {
    updatePack(packId, (p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }));
    refresh();
  }

  async function handleDownloadZip(pack: Pack): Promise<void> {
    if (pack.items.length === 0) {
      push('Pack is empty.', 'error');
      return;
    }
    try {
      const blob = await generateBatch({
        items: pack.items.map((i) => ({ name: i.label || undefined, request: i.request })),
      });
      downloadBlob(blob, `${pack.name.replace(/\s+/g, '-').toLowerCase() || 'pack'}.zip`);
      push('Pack exported as ZIP', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  }

  function handleExportJson(pack: Pack): void {
    downloadBlob(exportPack(pack), `${pack.name.replace(/\s+/g, '-').toLowerCase()}.json`);
  }

  async function handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      importPack(text);
      refresh();
      push('Pack imported', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Invalid pack file', 'error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <input
          className="border-border bg-surface-1 placeholder:text-muted-foreground focus:border-accent flex-1 rounded border px-2.5 py-1.5 font-mono text-[12px] focus:outline-none"
          placeholder="new pack name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          type="button"
          onClick={handleCreate}
          className="btn-accent inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide"
        >
          <Plus className="h-3 w-3" /> New
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="btn-ghost inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide"
        >
          <Upload className="h-3 w-3" /> Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {packs.length === 0 ? (
        <p className="text-muted-foreground text-[12px] leading-relaxed">
          No packs yet — create one to group multiple QR configs.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {packs.map((pack) => (
            <li key={pack.id} className="border-border bg-surface-2/40 rounded border">
              <div className="border-border flex items-center gap-1.5 border-b px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground/90 truncate text-[12px]">{pack.name}</p>
                  <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
                    {pack.items.length} item{pack.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddCurrent(pack.id)}
                  className="text-accent hover:bg-accent/10 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadZip(pack)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
                  aria-label="Export ZIP"
                >
                  <Download className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleExportJson(pack)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
                  aria-label="Export JSON"
                >
                  <Upload className="h-3 w-3 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deletePack(pack.id);
                    refresh();
                  }}
                  className={cn(
                    'text-muted-foreground hover:bg-muted hover:text-[color:var(--color-danger)] rounded p-1 transition-colors',
                  )}
                  aria-label="Delete pack"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {pack.items.length > 0 && (
                <ul className="flex flex-col px-1.5 py-1">
                  {pack.items.map((it) => (
                    <li
                      key={it.id}
                      className="text-foreground/85 hover:bg-muted/40 flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px]"
                    >
                      <span className="truncate">{it.label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(pack.id, it.id)}
                        className="text-muted-foreground hover:text-[color:var(--color-danger)]"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describeLabel(req: ReturnType<typeof useQR>['request']): string {
  switch (req.data.kind) {
    case 'url':
      return req.data.url;
    case 'wifi':
      return `wifi-${req.data.ssid}`;
    case 'vcard':
      return `${req.data.first_name}-${req.data.last_name}`.toLowerCase();
    default:
      return req.data.kind;
  }
}
