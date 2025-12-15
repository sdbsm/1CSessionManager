import { useCallback, useEffect, useMemo, useState } from 'react';

export type ClientsView = 'clients' | 'infobases' | 'publications';
export type StatusFilter = 'all' | 'active' | 'blocked' | 'warning';
export type LimitFilter = 'all' | 'limited' | 'unlimited';
export type OpsFilter = 'risk' | 'over' | 'noDbs' | 'noPubs';
export type SortBy = 'name' | 'sessions' | 'databases' | 'status';
export type SortOrder = 'asc' | 'desc';

export type SavedClientsViewSnapshot = {
  view: ClientsView;
  q: string;
  status: StatusFilter;
  limit: LimitFilter;
  ops: OpsFilter[];
  sortBy: SortBy;
  sortOrder: SortOrder;
  pubQ?: string;
  pubVer?: string;
  pubSite?: string;
};

export type SavedClientsView = {
  id: string;
  name: string;
  createdAtUtc: string;
  snapshot: SavedClientsViewSnapshot;
};

const STORAGE_KEY = 'ui.clients.savedViews.v1';

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function load(): SavedClientsView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        id: String(x.id || ''),
        name: String(x.name || ''),
        createdAtUtc: String(x.createdAtUtc || ''),
        snapshot: x.snapshot as SavedClientsViewSnapshot
      }))
      .filter(v => v.id && v.name && v.snapshot);
  } catch {
    return [];
  }
}

function save(next: SavedClientsView[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:clientsSavedViews'));
  } catch {
    // ignore
  }
}

export function useSavedClientsViews() {
  const [views, setViewsState] = useState<SavedClientsView[]>(() => load());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setViewsState(load());
    };
    const onCustom = () => setViewsState(load());
    window.addEventListener('storage', onStorage);
    window.addEventListener('ui:clientsSavedViews', onCustom as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ui:clientsSavedViews', onCustom as any);
    };
  }, []);

  const addView = useCallback((name: string, snapshot: SavedClientsViewSnapshot) => {
    const v: SavedClientsView = {
      id: makeId(),
      name: name.trim(),
      createdAtUtc: new Date().toISOString(),
      snapshot
    };
    const next = [v, ...load()].slice(0, 50);
    setViewsState(next);
    save(next);
    return v;
  }, []);

  const deleteView = useCallback((id: string) => {
    const next = load().filter(v => v.id !== id);
    setViewsState(next);
    save(next);
  }, []);

  const getById = useCallback((id: string) => {
    return load().find(v => v.id === id) || null;
  }, []);

  const sorted = useMemo(() => {
    const arr = [...views];
    arr.sort((a, b) => (b.createdAtUtc || '').localeCompare(a.createdAtUtc || '') || a.name.localeCompare(b.name));
    return arr;
  }, [views]);

  return { views: sorted, addView, deleteView, getById };
}


