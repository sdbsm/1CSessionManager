import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { AlertLevel, SystemEvent } from '../../../types';
import { useUiPrefs } from '../../../hooks/useUiPrefs';
import { formatAbsoluteRu, formatRelativeShort } from '../../../utils/time';

export type GroupBy = 'client' | 'infobase' | 'time';

export interface EventGroupRow {
  key: string;
  label: string;
  clientId?: string;
  databaseName?: string;
  bucketFrom?: Date;
  bucketTo?: Date;
  critical: number;
  warning: number;
  info: number;
  total: number;
  lastTs: Date;
  severity: AlertLevel;
}

function eventDateUtc(e: SystemEvent): Date {
  if (e.timestampUtc) return new Date(e.timestampUtc);
  if (e.timestamp) return new Date(e.timestamp);
  if (e.timestampLocal) return new Date(e.timestampLocal);
  return new Date(0);
}

function bucketSizeMsFor(spanMs: number): number {
  // Reasonable buckets for operational UX.
  if (!Number.isFinite(spanMs) || spanMs <= 0) return 60 * 60_000; // 1h default
  if (spanMs <= 2 * 60 * 60_000) return 5 * 60_000; // 5m
  if (spanMs <= 6 * 60 * 60_000) return 10 * 60_000; // 10m
  if (spanMs <= 24 * 60 * 60_000) return 60 * 60_000; // 1h
  if (spanMs <= 7 * 24 * 60 * 60_000) return 6 * 60 * 60_000; // 6h
  if (spanMs <= 31 * 24 * 60 * 60_000) return 24 * 60 * 60_000; // 1d
  return 7 * 24 * 60 * 60_000; // 1w
}

function formatBucketLabel(from: Date, to: Date): string {
  // Display as "15.12 10:00–10:59" (or similar), in ru-RU locale.
  const date = from.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const start = from.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  // show inclusive end minute for readability
  const endInclusive = new Date(to.getTime() - 1000);
  const end = endInclusive.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${start}–${end}`;
}

function severityOf(row: { critical: number; warning: number; info: number }): AlertLevel {
  if (row.critical > 0) return AlertLevel.CRITICAL;
  if (row.warning > 0) return AlertLevel.WARNING;
  return AlertLevel.INFO;
}

function levelIcon(level: AlertLevel) {
  if (level === AlertLevel.CRITICAL) return <AlertCircle size={14} className="text-rose-400" />;
  if (level === AlertLevel.WARNING) return <AlertTriangle size={14} className="text-amber-400" />;
  return <Info size={14} className="text-sky-400" />;
}

export const EventGroups: React.FC<{
  events: SystemEvent[];
  groupBy: GroupBy;
  onSelect: (row: EventGroupRow) => void;
}> = ({ events, groupBy, onSelect }) => {
  const { prefs } = useUiPrefs();
  const rows = useMemo<EventGroupRow[]>(() => {
    const map = new Map<string, EventGroupRow>();

    const bucketMs = (() => {
      if (groupBy !== 'time') return 0;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const e of events) {
        const t = eventDateUtc(e).getTime();
        if (!Number.isFinite(t) || t <= 0) continue;
        if (t < min) min = t;
        if (t > max) max = t;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return bucketSizeMsFor(0);
      return bucketSizeMsFor(max - min);
    })();

    for (const e of events) {
      const dt = eventDateUtc(e);
      let key = '';
      let label = '';
      let clientId: string | undefined;
      let databaseName: string | undefined;
      let bucketFrom: Date | undefined;
      let bucketTo: Date | undefined;

      if (groupBy === 'client') {
        clientId = e.clientId || undefined;
        key = clientId ? `client:${clientId}` : `clientName:${(e.clientName || '—').toLowerCase()}`;
        label = e.clientName || (clientId ? clientId : '—');
      } else if (groupBy === 'infobase') {
        databaseName = e.databaseName || undefined;
        key = databaseName ? `db:${databaseName.toLowerCase()}` : 'db:—';
        label = databaseName || '—';
      } else {
        const t = dt.getTime();
        const safeBucketMs = bucketMs > 0 ? bucketMs : 60 * 60_000;
        const startMs = Number.isFinite(t) && t > 0 ? Math.floor(t / safeBucketMs) * safeBucketMs : 0;
        bucketFrom = new Date(startMs);
        bucketTo = new Date(startMs + safeBucketMs);
        key = `time:${startMs}`;
        label = startMs > 0 ? formatBucketLabel(bucketFrom, bucketTo) : '—';
      }

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          label,
          clientId,
          databaseName,
          bucketFrom,
          bucketTo,
          critical: e.level === AlertLevel.CRITICAL ? 1 : 0,
          warning: e.level === AlertLevel.WARNING ? 1 : 0,
          info: e.level === AlertLevel.INFO ? 1 : 0,
          total: 1,
          lastTs: dt,
          severity: e.level
        });
      } else {
        existing.total += 1;
        if (e.level === AlertLevel.CRITICAL) existing.critical += 1;
        else if (e.level === AlertLevel.WARNING) existing.warning += 1;
        else existing.info += 1;
        if (dt.getTime() > existing.lastTs.getTime()) existing.lastTs = dt;
        existing.severity = severityOf(existing);
        if (!existing.clientId && clientId) existing.clientId = clientId;
      }
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const sa = a.severity === AlertLevel.CRITICAL ? 3 : a.severity === AlertLevel.WARNING ? 2 : 1;
      const sb = b.severity === AlertLevel.CRITICAL ? 3 : b.severity === AlertLevel.WARNING ? 2 : 1;
      if (sb !== sa) return sb - sa;
      if (b.total !== a.total) return b.total - a.total;
      return b.lastTs.getTime() - a.lastTs.getTime();
    });
    return arr.slice(0, 200);
  }, [events, groupBy]);

  if (rows.length === 0) {
    return <div className="p-8 text-sm text-slate-500">Нет данных для группировки.</div>;
  }

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-slate-950 z-10 shadow-sm border-b border-white/10">
          <tr>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400 w-[42%]">
              {groupBy === 'client' ? 'Клиент' : groupBy === 'infobase' ? 'Инфобаза' : 'Окно времени'}
            </th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400 w-[120px]">Critical</th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400 w-[120px]">Warning</th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400 w-[120px]">Всего</th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400">Последнее</th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400 w-[40px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm">
          {rows.map(r => (
            <tr
              key={r.key}
              className="cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => onSelect(r)}
              title={groupBy === 'time' ? 'Открыть события этого окна' : 'Открыть события этой группы'}
            >
              <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {levelIcon(r.severity)}
                  <span className="text-slate-100 font-semibold truncate">{r.label}</span>
                </div>
              </td>
              <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'}`}>
                <span className={r.critical > 0 ? 'text-rose-200 font-semibold' : 'text-slate-500'}>{r.critical}</span>
              </td>
              <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'}`}>
                <span className={r.warning > 0 ? 'text-amber-200 font-semibold' : 'text-slate-500'}>{r.warning}</span>
              </td>
              <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} text-slate-200 font-semibold`}>{r.total}</td>
              <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} text-xs font-mono text-slate-400 whitespace-nowrap`}>
                {r.lastTs.getTime() > 0 ? (
                  prefs.timeFormat === 'relative'
                    ? <span title={formatAbsoluteRu(r.lastTs)}>{formatRelativeShort(r.lastTs)}</span>
                    : <span>{formatAbsoluteRu(r.lastTs)}</span>
                ) : '—'}
              </td>
              <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} text-slate-600`}>
                <ChevronRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


