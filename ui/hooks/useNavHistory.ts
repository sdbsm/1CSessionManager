import { useCallback, useEffect, useMemo, useState } from 'react';

type NavHistoryState = {
  stack: string[]; // previous hashes, newest last
};

const STORAGE_KEY = 'ui.navHistory.v1';
const MAX = 30;

function safeLoad(): NavHistoryState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { stack: [] };
    const parsed = JSON.parse(raw) as NavHistoryState;
    if (!parsed || !Array.isArray(parsed.stack)) return { stack: [] };
    return { stack: parsed.stack.filter(Boolean).slice(-MAX) };
  } catch {
    return { stack: [] };
  }
}

function safeSave(next: NavHistoryState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function hashFromUrl(url: string): string {
  try {
    const u = new URL(url, window.location.href);
    return u.hash || '';
  } catch {
    const idx = url.indexOf('#');
    return idx >= 0 ? url.slice(idx) : '';
  }
}

function normalizeHash(h: string): string {
  if (!h) return '';
  return h.startsWith('#') ? h : `#${h}`;
}

export function useNavHistory() {
  const [state, setState] = useState<NavHistoryState>(() => safeLoad());

  useEffect(() => {
    const onHash = (e: HashChangeEvent) => {
      const prev = normalizeHash(hashFromUrl(e.oldURL || ''));
      const next = normalizeHash(hashFromUrl(e.newURL || ''));
      if (!prev || !next) return;
      if (prev === next) return;

      setState((cur) => {
        const currentStack = cur.stack.length ? cur.stack : safeLoad().stack;
        const last = currentStack[currentStack.length - 1];
        const merged = last === prev ? currentStack : [...currentStack, prev];
        const trimmed = merged.slice(-MAX);
        const ns = { stack: trimmed };
        safeSave(ns);
        return ns;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const canGoBack = state.stack.length > 0;
  const peekBack = canGoBack ? state.stack[state.stack.length - 1] : null;

  const goBack = useCallback(() => {
    setState((cur) => {
      const currentStack = cur.stack.length ? cur.stack : safeLoad().stack;
      const prev = currentStack[currentStack.length - 1];
      const nextStack = currentStack.slice(0, -1);
      const ns = { stack: nextStack };
      safeSave(ns);
      if (prev) window.location.hash = prev;
      return ns;
    });
  }, []);

  const reset = useCallback(() => {
    const ns = { stack: [] as string[] };
    safeSave(ns);
    setState(ns);
  }, []);

  return useMemo(
    () => ({ canGoBack, peekBack, goBack, reset, size: state.stack.length }),
    [canGoBack, goBack, peekBack, reset, state.stack.length]
  );
}


