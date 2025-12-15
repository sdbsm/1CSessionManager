import { useState, useEffect } from 'react';
import { apiFetchJson } from '../services/apiClient';
import { SystemEvent } from '../types';
import { TimeRange } from './useTimeRange';

export interface DiskInfo {
  Name: string;
  TotalGB: number;
  FreeGB: number;
}

export interface DashboardStats {
  databaseStats: Record<string, { sessions: number; sizeMB?: number | null }>;
  totalDatabases?: number;
  connectionTypes: Record<string, number>;
  clusterStatus: 'online' | 'offline' | 'unknown';
  serverMetrics?: {
    cpu: number;
    memory: { used: number; total: number; percent: number };
    disks?: DiskInfo[];
  };
  lastUpdate: string | null;
}

export interface TopClient {
  id: string;
  name: string;
  activeSessions: number;
  maxSessions: number;
  utilization: number;
  status: string;
  reason?: string;
}

export interface DatabaseInfo {
  name: string;
  sessions: number;
  sizeMB: number;
}

export function useDashboardData(timeRange: TimeRange) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [warnings, setWarnings] = useState<TopClient[]>([]);
  const [recentEvents, setRecentEvents] = useState<SystemEvent[]>([]);
  
  // Computed DB stats
  const [totalDbSizeGB, setTotalDbSizeGB] = useState<number>(0);
  const [largestDatabases, setLargestDatabases] = useState<DatabaseInfo[]>([]);

  const [apiHealth, setApiHealth] = useState<'ok' | 'unknown'>('unknown');
  const [dbEndpointStatus, setDbEndpointStatus] = useState<'set' | 'not_set' | 'unknown'>('unknown');
  const [sqlLoginStatus, setSqlLoginStatus] = useState<'set' | 'not_set' | 'unknown'>('unknown');
  const [licensesTotal, setLicensesTotal] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [statsRes, topRes, warnRes, healthRes, dbRes, sqlRes, licRes, eventsRes] = await Promise.all([
          apiFetchJson<DashboardStats>('/api/dashboard/stats'),
          apiFetchJson<TopClient[]>('/api/dashboard/top-clients'),
          apiFetchJson<TopClient[]>('/api/dashboard/warnings'),
          apiFetchJson<{ status: string }>('/api/health'),
          apiFetchJson<{ isSet: boolean }>('/api/setup/db/status', { skipAuthHeader: true }),
          apiFetchJson<{ isSet: boolean }>('/api/setup/sql/status', { skipAuthHeader: true }),
          apiFetchJson<{ isSet: boolean; total?: number | null }>('/api/admin/licenses/status'),
          apiFetchJson<SystemEvent[]>(
            `/api/events?fromUtc=${encodeURIComponent(timeRange.fromUtc.toISOString())}&toUtc=${encodeURIComponent(timeRange.toUtc.toISOString())}&levels=critical,warning&take=50`
          )
        ]);

        if (!alive) return;
        setStats(statsRes);
        setTopClients(topRes);
        setWarnings(warnRes);
        
        // Calculate DB totals
        let totalSize = 0;
        const dbs: DatabaseInfo[] = [];
        if (statsRes?.databaseStats) {
          Object.entries(statsRes.databaseStats).forEach(([name, data]) => {
            const size = data.sizeMB ?? 0;
            totalSize += size;
            if (size > 0) {
              dbs.push({ name, sessions: data.sessions, sizeMB: size });
            }
          });
        }
        setTotalDbSizeGB(Math.round((totalSize / 1024) * 100) / 100);
        setLargestDatabases(dbs.sort((a, b) => b.sizeMB - a.sizeMB).slice(0, 5));

        setApiHealth(healthRes?.status === 'ok' ? 'ok' : 'unknown');
        setDbEndpointStatus(dbRes.isSet ? 'set' : 'not_set');
        setSqlLoginStatus(sqlRes.isSet ? 'set' : 'not_set');
        setLicensesTotal(licRes.isSet && typeof licRes.total === 'number' ? licRes.total : null);
        setRecentEvents(eventsRes);
      } catch (e) {
        console.error('Failed to load status dashboard', e);
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
  }, [timeRange.fromUtc, timeRange.toUtc]);

  return {
    stats,
    topClients,
    warnings,
    recentEvents,
    totalDbSizeGB,
    largestDatabases,
    apiHealth,
    dbEndpointStatus,
    sqlLoginStatus,
    licensesTotal,
    loading
  };
}
