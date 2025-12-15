import { useCallback, useEffect, useMemo, useState } from 'react';

export type SavedLink = {
  id: string;
  name: string;
  hash: string;
  createdAtUtc: string;
};

const STORAGE_KEY = 'ui.cmdk.savedLinks.v1';

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function load(): SavedLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        id: String(x.id || ''),
        name: String(x.name || ''),
        hash: String(x.hash || ''),
        createdAtUtc: String(x.createdAtUtc || '')
      }))
      .filter(v => v.id && v.name && v.hash);
  } catch {
    return [];
  }
}

function save(next: SavedLink[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:savedLinks'));
  } catch {
    // ignore
  }
}

export function useSavedLinks() {
  const [links, setLinksState] = useState<SavedLink[]>(() => load());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setLinksState(load());
    };
    const onCustom = () => setLinksState(load());
    window.addEventListener('storage', onStorage);
    window.addEventListener('ui:savedLinks', onCustom as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ui:savedLinks', onCustom as any);
    };
  }, []);

  const addLink = useCallback((name: string, hash: string) => {
    const n = (name || '').trim();
    const h = (hash || '').trim();
    if (!n || !h) return null;

    const v: SavedLink = {
      id: makeId(),
      name: n,
      hash: h,
      createdAtUtc: new Date().toISOString()
    };

    const next = [v, ...load()].slice(0, 50);
    setLinksState(next);
    save(next);
    return v;
  }, []);

  const deleteLink = useCallback((id: string) => {
    const next = load().filter(v => v.id !== id);
    setLinksState(next);
    save(next);
  }, []);

  const sorted = useMemo(() => {
    const arr = [...links];
    arr.sort((a, b) => (b.createdAtUtc || '').localeCompare(a.createdAtUtc || '') || a.name.localeCompare(b.name));
    return arr;
  }, [links]);

  return { links: sorted, addLink, deleteLink };
}


