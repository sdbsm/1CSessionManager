import { useState, useEffect, useMemo, useCallback } from 'react';
import { SystemEvent, AlertLevel } from '../types';
import { apiFetch, apiFetchJson } from '../services/apiClient';
import { TimeRange } from './useTimeRange';

export type SortField = 'timestamp' | 'level';
export type SortDirection = 'asc' | 'desc';

function parseHashQuery(): URLSearchParams {
  const raw = window.location.hash || '';
  const idx = raw.indexOf('?');
  if (idx < 0) return new URLSearchParams();
  return new URLSearchParams(raw.slice(idx + 1));
}

function setHashQuery(next: URLSearchParams) {
  const [path] = (window.location.hash || '#/events').split('?');
  const qs = next.toString();
  window.location.hash = qs ? `${path}?${qs}` : path;
}

function levelOrder(level: AlertLevel): number {
  return level === 'critical' ? 3 : level === 'warning' ? 2 : 1;
}

function eventDateUtc(e: SystemEvent): Date {
  if (e.timestampUtc) return new Date(e.timestampUtc);
  if (e.timestamp) return new Date(e.timestamp);
  if (e.timestampLocal) return new Date(e.timestampLocal);
  return new Date(0);
}

export interface EventsFilters {
  levels: Set<AlertLevel>;
  search: string;
  clientId: string;
  database: string;
  user: string;
}

export function useEvents(timeRange: TimeRange) {
  // State for filters
  const [filters, setFilters] = useState<EventsFilters>(() => {
    const qp = parseHashQuery();
    const rawLevels = qp.get('levels') || '';
    const levelTokens = rawLevels.split(',').map(s => s.trim()).filter(Boolean);
    const levels = new Set<AlertLevel>();
    for (const t of levelTokens) {
      if (t === 'info' || t === 'warning' || t === 'critical') levels.add(t as AlertLevel);
    }
    if (levels.size === 0) {
      levels.add(AlertLevel.CRITICAL);
      levels.add(AlertLevel.WARNING);
      levels.add(AlertLevel.INFO);
    }

    return {
      levels,
      search: qp.get('q') || '',
      clientId: qp.get('clientId') || '',
      database: qp.get('database') || '',
      user: qp.get('user') || ''
    };
  });

  // State for data
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date(0));
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sync URL with filters
  useEffect(() => {
    const qp = new URLSearchParams();
    const levels = Array.from(filters.levels).sort((a, b) => levelOrder(b) - levelOrder(a));
    if (levels.length !== 3) qp.set('levels', levels.join(','));
    if (filters.search.trim()) qp.set('q', filters.search.trim());
    if (filters.clientId) qp.set('clientId', filters.clientId);
    if (filters.database.trim()) qp.set('database', filters.database.trim());
    if (filters.user.trim()) qp.set('user', filters.user.trim());
    setHashQuery(qp);
  }, [filters]);

  const fetchEvents = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Add buffer for clock skew
      const toBuffered = new Date(timeRange.toUtc.getTime() + 5 * 60_000); 

      const qp = new URLSearchParams();
      qp.set('fromUtc', timeRange.fromUtc.toISOString());
      qp.set('toUtc', toBuffered.toISOString());
      qp.set('take', '500');

      const levels = Array.from(filters.levels).sort((a, b) => levelOrder(b) - levelOrder(a));
      qp.set('levels', levels.join(','));
      if (filters.search.trim()) qp.set('q', filters.search.trim());
      if (filters.clientId) qp.set('clientId', filters.clientId);
      if (filters.database.trim()) qp.set('database', filters.database.trim());
      if (filters.user.trim()) qp.set('user', filters.user.trim());

      const data = await apiFetchJson<SystemEvent[]>(`/api/events?${qp.toString()}`);
      setEvents(data);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Failed to fetch events', e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [timeRange, filters]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const id = window.setInterval(fetchEvents, 10_000);
    return () => window.clearInterval(id);
  }, [autoRefreshEnabled, fetchEvents]);

  const sortedEvents = useMemo(() => {
    const arr = [...events];
    arr.sort((a, b) => {
      if (sortField === 'timestamp') {
        const da = eventDateUtc(a).getTime();
        const db = eventDateUtc(b).getTime();
        return sortDirection === 'desc' ? db - da : da - db;
      }
      const oa = levelOrder(a.level);
      const ob = levelOrder(b.level);
      return sortDirection === 'desc' ? ob - oa : oa - ob;
    });
    return arr;
  }, [events, sortField, sortDirection]);

  const levelStats = useMemo(() => {
    const stats = { info: 0, warning: 0, critical: 0 };
    events.forEach(e => { 
        if (e.level in stats) stats[e.level]++; 
    });
    return stats;
  }, [events]);

  const toggleLevel = (level: AlertLevel) => {
    setFilters(prev => {
      const next = new Set(prev.levels);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      // Prevent empty set
      return { ...prev, levels: next.size ? next : new Set([AlertLevel.CRITICAL, AlertLevel.WARNING, AlertLevel.INFO]) };
    });
  };

  const setFilterValue = (key: keyof EventsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      levels: new Set([AlertLevel.CRITICAL, AlertLevel.WARNING, AlertLevel.INFO]),
      search: '',
      clientId: '',
      database: '',
      user: ''
    });
  };

  const handleClearEvents = async () => {
    if (!window.confirm('Очистить все события? Это действие необратимо.')) return;
    try {
      const res = await apiFetch('/api/events', { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      await fetchEvents();
    } catch (e) {
      console.error('Error clearing events:', e);
      alert('Ошибка при очистке событий');
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDirection('desc');
    }
  };

  return {
    events: sortedEvents,
    loading,
    isRefreshing,
    lastUpdate,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    refresh: fetchEvents,
    filters,
    setFilterValue,
    toggleLevel,
    clearFilters,
    levelStats,
    sortField,
    sortDirection,
    toggleSort,
    handleClearEvents
  };
}
