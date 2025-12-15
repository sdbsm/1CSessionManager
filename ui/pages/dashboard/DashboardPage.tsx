import React from 'react';
import { Client } from '../../types';
import { TimeRange, TimeRangePreset } from '../../hooks/useTimeRange';
import { useDashboardData } from '../../hooks/useDashboardData';
import { HealthStatus } from './HealthStatus';
import { ActiveIssues } from './ActiveIssues';
import { StatsOverview } from './StatsOverview';
import { SystemStats } from './SystemStats';
import { TopDatabases } from './TopDatabases';
import { WarningsList } from './WarningsList';
import { RecentEvents } from './RecentEvents';
import { Spinner } from '../../components/ui/Spinner';

interface DashboardProps {
  clients: Client[];
  timeRange: TimeRange;
  timePreset: TimeRangePreset;
  setTimePreset: (preset: TimeRangePreset) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ clients, timeRange, timePreset, setTimePreset }) => {
  const {
    stats,
    topClients, // Currently unused in overview, but available for future widgets
    warnings,
    recentEvents,
    totalDbSizeGB,
    largestDatabases,
    apiHealth,
    dbEndpointStatus,
    sqlLoginStatus,
    licensesTotal,
    loading
  } = useDashboardData(timeRange);

  const totalSessions = clients.reduce((acc, c) => acc + c.activeSessions, 0);
  const fallbackClientLimit = clients.reduce((acc, c) => acc + (c.maxSessions > 0 ? c.maxSessions : 0), 0);

  const licenseCap = typeof licensesTotal === 'number' && licensesTotal > 0 ? licensesTotal : null;
  const effectiveCap = licenseCap ?? (fallbackClientLimit > 0 ? fallbackClientLimit : null);
  const utilizationRate = effectiveCap ? Math.round((totalSessions / effectiveCap) * 100) : 0;
  const remainingLicenses = licenseCap ? Math.max(0, licenseCap - totalSessions) : null;
  const activeClientsCount = clients.filter(c => c.activeSessions > 0).length;

  const criticalClientsCount = clients.filter(c =>
    c.status === 'blocked' || (c.maxSessions > 0 && c.activeSessions >= c.maxSessions)
  ).length;

  if (loading && !stats) {
    return (
      <Spinner centered text="Загрузка состояния..." />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-50">Обзор</h1>
        <div className="text-sm text-slate-400">
          Сначала состояние и риски, затем причины.
        </div>
      </div>

      {/* Primary: Health */}
      <HealthStatus 
        apiHealth={apiHealth} 
        stats={stats} 
        dbEndpointStatus={dbEndpointStatus} 
        sqlLoginStatus={sqlLoginStatus} 
      />

      {/* Primary: Active issues */}
      <ActiveIssues
        stats={stats}
        dbEndpointStatus={dbEndpointStatus}
        sqlLoginStatus={sqlLoginStatus}
        criticalClientsCount={criticalClientsCount}
        warnings={warnings}
        licenseCap={licenseCap}
      />

      {/* Secondary: Snapshot */}
      <StatsOverview
        totalSessions={totalSessions}
        licenseCap={licenseCap}
        effectiveCap={effectiveCap}
        utilizationRate={utilizationRate}
        remainingLicenses={remainingLicenses}
        fallbackClientLimit={fallbackClientLimit}
        activeClientsCount={activeClientsCount}
        totalClientsCount={clients.length}
        warningsCount={warnings.length}
        clusterStatus={stats?.clusterStatus ?? 'unknown'}
      />

      {/* Secondary: System Resources */}
      <SystemStats 
        serverMetrics={stats?.serverMetrics} 
        totalDatabases={stats?.totalDatabases} 
        totalDbSizeGB={totalDbSizeGB}
      />

      {/* Secondary: Warnings + DBs + Recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <WarningsList warnings={warnings} />
        <TopDatabases databases={largestDatabases} />
        <RecentEvents events={recentEvents} />
      </div>
    </div>
  );
};

export default Dashboard;
