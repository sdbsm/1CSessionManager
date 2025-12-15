import { useCallback, useEffect, useMemo, useState } from 'react';

export type UiDensity = 'comfortable' | 'compact';
export type UiTimeFormat = 'absolute' | 'relative';

export interface UiPrefs {
  density: UiDensity;
  autoRefreshDefault: boolean;
  timeFormat: UiTimeFormat;
}

const STORAGE_KEY = 'ui.prefs.v1';

const DEFAULT_PREFS: UiPrefs = {
  density: 'comfortable',
  autoRefreshDefault: true,
  timeFormat: 'absolute'
};

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    const density = parsed.density === 'compact' ? 'compact' : 'comfortable';
    const timeFormat = parsed.timeFormat === 'relative' ? 'relative' : 'absolute';
    const autoRefreshDefault = typeof parsed.autoRefreshDefault === 'boolean'
      ? parsed.autoRefreshDefault
      : DEFAULT_PREFS.autoRefreshDefault;
    return { density, timeFormat, autoRefreshDefault };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveUiPrefs(next: UiPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:prefs'));
  } catch {
    // ignore
  }
}

export function resetUiPrefs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:prefs'));
  } catch {
    // ignore
  }
}

export function useUiPrefs() {
  const [prefs, setPrefsState] = useState<UiPrefs>(() => loadUiPrefs());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setPrefsState(loadUiPrefs());
    };
    const onCustom = () => setPrefsState(loadUiPrefs());
    window.addEventListener('storage', onStorage);
    window.addEventListener('ui:prefs', onCustom as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ui:prefs', onCustom as any);
    };
  }, []);

  const setPrefs = useCallback((next: UiPrefs) => {
    setPrefsState(next);
    saveUiPrefs(next);
  }, []);

  const updatePrefs = useCallback((patch: Partial<UiPrefs>) => {
    const next = { ...loadUiPrefs(), ...patch } as UiPrefs;
    setPrefs(next);
  }, [setPrefs]);

  const reset = useCallback(() => {
    setPrefsState(DEFAULT_PREFS);
    resetUiPrefs();
  }, []);

  return useMemo(() => ({ prefs, setPrefs, updatePrefs, reset }), [prefs, setPrefs, updatePrefs, reset]);
}


