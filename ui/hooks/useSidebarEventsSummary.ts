import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson } from '../services/apiClient';
import { AlertLevel, SystemEvent } from '../types';
import { computeTimeRange, TimeRange } from './useTimeRange';

export interface SidebarEventsSummary {
  loading: boolean;
  critical: number;
  warning: number;
  newCount: number;
  lastUpdate: Date;
}

function eventDateUtc(e: SystemEvent): Date {
  if (e.timestampUtc) return new Date(e.timestampUtc);
  if (e.timestamp) return new Date(e.timestamp);
  if (e.timestampLocal) return new Date(e.timestampLocal);
  return new Date(0);
}

export function useSidebarEventsSummary(timeRange: TimeRange, lastSeenUtcIso?: string | null): SidebarEventsSummary {
  const [loading, setLoading] = useState(true);
  const [critical, setCritical] = useState(0);
  const [warning, setWarning] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date(0));

  const range = useMemo(() => computeTimeRange(timeRange.preset), [timeRange.preset]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const toBuffered = new Date(range.toUtc.getTime() + 5 * 60_000);
        const qp = new URLSearchParams();
        qp.set('fromUtc', range.fromUtc.toISOString());
        qp.set('toUtc', toBuffered.toISOString());
        qp.set('levels', 'critical,warning');
        qp.set('take', '200');

        const data = await apiFetchJson<SystemEvent[]>(`/api/events?${qp.toString()}`);
        if (!alive) return;
        let c = 0;
        let w = 0;
        let n = 0;
        const lastSeen = lastSeenUtcIso ? new Date(lastSeenUtcIso) : null;
        for (const e of data) {
          if (e.level === AlertLevel.CRITICAL) c++;
          else if (e.level === AlertLevel.WARNING) w++;
          if (lastSeen) {
            const dt = eventDateUtc(e);
            if (dt.getTime() > lastSeen.getTime()) n++;
          }
        }
        setCritical(c);
        setWarning(w);
        setNewCount(n);
        setLastUpdate(new Date());
      } catch (e) {
        // keep last known values; sidebar shouldn't be noisy
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const id = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [range.fromUtc, range.toUtc, lastSeenUtcIso]);

  return { loading, critical, warning, newCount, lastUpdate };
}


