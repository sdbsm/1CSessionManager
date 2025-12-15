import { SystemEvent } from '../types';
import { UiTimeFormat } from '../hooks/useUiPrefs';

export function eventDateUtc(e: SystemEvent): Date | null {
  try {
    if (e.timestampUtc) return new Date(e.timestampUtc);
    if (e.timestamp) return new Date(e.timestamp);
    if (e.timestampLocal) return new Date(e.timestampLocal);
    return null;
  } catch {
    return null;
  }
}

export function formatRelativeShort(date: Date, now = new Date()): string {
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (!Number.isFinite(diffSec)) return '—';
  if (diffSec < 5) return 'только что';
  if (diffSec < 60) return `${diffSec}с назад`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}м назад`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}ч назад`;
  return `${Math.floor(diffSec / 86400)}д назад`;
}

export function formatAbsoluteRu(date: Date): string {
  return date.toLocaleString('ru-RU');
}

export function formatEventTimestamp(e: SystemEvent, mode: UiTimeFormat): { text: string; title?: string } {
  const d = eventDateUtc(e);
  if (!d) return { text: '—' };
  const abs = formatAbsoluteRu(d);
  if (mode === 'relative') return { text: formatRelativeShort(d), title: abs };
  return { text: abs };
}


