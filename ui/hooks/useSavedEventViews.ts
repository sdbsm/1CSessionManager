import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertLevel } from '../types';

export type SavedEventsViewMode = 'list' | 'groups';
export type SavedEventsGroupBy = 'client' | 'infobase' | 'time';

export type SavedEventsViewSnapshot = {
  filters: {
    levels: AlertLevel[];
    search: string;
    clientId: string;
    database: string;
    user: string;
  };
  viewMode: SavedEventsViewMode;
  groupBy: SavedEventsGroupBy;
};

export type SavedEventsView = {
  id: string;
  name: string;
  createdAtUtc: string;
  snapshot: SavedEventsViewSnapshot;
};

const STORAGE_KEY = 'ui.events.savedViews.v1';

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSnapshot(raw: any): SavedEventsViewSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const filtersRaw = (raw as any).filters || {};
  const levelsRaw = Array.isArray(filtersRaw.levels) ? (filtersRaw.levels as any[]) : [];
  const levels = levelsRaw
    .map(x => String(x))
    .filter((x): x is AlertLevel => x === AlertLevel.INFO || x === AlertLevel.WARNING || x === AlertLevel.CRITICAL);

  const viewMode: SavedEventsViewMode = raw.viewMode === 'groups' ? 'groups' : 'list';
  const groupBy: SavedEventsGroupBy =
    raw.groupBy === 'infobase' || raw.groupBy === 'time' ? raw.groupBy : 'client';

  return {
    filters: {
      levels: levels.length ? levels : [AlertLevel.CRITICAL, AlertLevel.WARNING, AlertLevel.INFO],
      search: String(filtersRaw.search || ''),
      clientId: String(filtersRaw.clientId || ''),
      database: String(filtersRaw.database || ''),
      user: String(filtersRaw.user || '')
    },
    viewMode,
    groupBy
  };
}

function load(): SavedEventsView[] {
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
        snapshot: normalizeSnapshot(x.snapshot)
      }))
      .filter((v): v is SavedEventsView => !!(v.id && v.name && v.snapshot));
  } catch {
    return [];
  }
}

function save(next: SavedEventsView[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:eventsSavedViews'));
  } catch {
    // ignore
  }
}

export function useSavedEventViews() {
  const [views, setViewsState] = useState<SavedEventsView[]>(() => load());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setViewsState(load());
    };
    const onCustom = () => setViewsState(load());
    window.addEventListener('storage', onStorage);
    window.addEventListener('ui:eventsSavedViews', onCustom as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ui:eventsSavedViews', onCustom as any);
    };
  }, []);

  const addView = useCallback((name: string, snapshot: SavedEventsViewSnapshot) => {
    const v: SavedEventsView = {
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


