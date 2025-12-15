import { useState, useMemo } from 'react';

export type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | '7d';
export type TimeRange = { preset: TimeRangePreset; toUtc: Date; fromUtc: Date };

function computeTimeRange(preset: TimeRangePreset): TimeRange {
  const toUtc = new Date();
  const ms = preset === '15m' ? 15 * 60_000
    : preset === '1h' ? 60 * 60_000
    : preset === '6h' ? 6 * 60 * 60_000
    : preset === '24h' ? 24 * 60 * 60_000
    : 7 * 24 * 60 * 60_000;
  const fromUtc = new Date(toUtc.getTime() - ms);
  return { preset, toUtc, fromUtc };
}

export function useTimeRange() {
  const [preset, setPreset] = useState<TimeRangePreset>(() => {
    try {
      const v = localStorage.getItem('ui.timerange') as TimeRangePreset | null;
      if (v === '15m' || v === '1h' || v === '6h' || v === '24h' || v === '7d') return v;
      return '1h';
    } catch {
      return '1h';
    }
  });

  const range = useMemo(() => computeTimeRange(preset), [preset]);

  const set = (next: TimeRangePreset) => {
    setPreset(next);
    try { localStorage.setItem('ui.timerange', next); } catch { /* ignore */ }
  };

  return { range, preset, setPreset: set };
}
