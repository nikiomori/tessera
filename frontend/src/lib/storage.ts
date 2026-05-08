import { nanoid } from 'nanoid';

import type { GenerateRequest } from '@/types/qr';

const HISTORY_KEY = 'tessera:history:v1';
const PACKS_KEY = 'tessera:packs:v1';
const HISTORY_LIMIT = 50;

export interface HistoryItem {
  id: string;
  created_at: string;
  request: GenerateRequest;
  thumbnail: string; // base64 data URL, ~5-10KB
  label: string;
}

export interface Pack {
  id: string;
  name: string;
  created_at: string;
  items: { id: string; label: string; request: GenerateRequest }[];
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('localStorage write failed', err);
  }
}

export function loadHistory(): HistoryItem[] {
  return read<HistoryItem[]>(HISTORY_KEY) ?? [];
}

export function pushHistory(item: Omit<HistoryItem, 'id' | 'created_at'>): HistoryItem {
  const newItem: HistoryItem = { id: nanoid(8), created_at: new Date().toISOString(), ...item };
  const next = [newItem, ...loadHistory()].slice(0, HISTORY_LIMIT);
  write(HISTORY_KEY, next);
  return newItem;
}

export function removeHistory(id: string): void {
  write(HISTORY_KEY, loadHistory().filter((it) => it.id !== id));
}

export function clearHistory(): void {
  write(HISTORY_KEY, []);
}

export function loadPacks(): Pack[] {
  return read<Pack[]>(PACKS_KEY) ?? [];
}

export function savePacks(packs: Pack[]): void {
  write(PACKS_KEY, packs);
}

export function createPack(name: string): Pack {
  const pack: Pack = {
    id: nanoid(8),
    name,
    created_at: new Date().toISOString(),
    items: [],
  };
  savePacks([pack, ...loadPacks()]);
  return pack;
}

export function updatePack(id: string, mutator: (p: Pack) => Pack): void {
  savePacks(loadPacks().map((p) => (p.id === id ? mutator(p) : p)));
}

export function deletePack(id: string): void {
  savePacks(loadPacks().filter((p) => p.id !== id));
}

export function exportPack(pack: Pack): Blob {
  return new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
}

export function importPack(json: string): Pack {
  const parsed = JSON.parse(json) as Pack;
  if (!parsed.id || !parsed.name || !Array.isArray(parsed.items)) {
    throw new Error('Invalid pack file.');
  }
  // Re-id to avoid clobbering an existing pack with the same id
  const fresh: Pack = { ...parsed, id: nanoid(8) };
  savePacks([fresh, ...loadPacks()]);
  return fresh;
}
