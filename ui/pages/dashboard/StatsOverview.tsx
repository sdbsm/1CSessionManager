import React from 'react';
import { Activity, Users, AlertTriangle, Server } from 'lucide-react';
import StatCard from '../../components/StatCard';

interface StatsOverviewProps {
  totalSessions: number;
  licenseCap: number | null;
  effectiveCap: number | null;
  utilizationRate: number;
  remainingLicenses: number | null;
  fallbackClientLimit: number;
  activeClientsCount: number;
  totalClientsCount: number;
  warningsCount: number;
  clusterStatus: 'online' | 'offline' | 'unknown';
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalSessions,
  licenseCap,
  effectiveCap,
  utilizationRate,
  remainingLicenses,
  fallbackClientLimit,
  activeClientsCount,
  totalClientsCount,
  warningsCount,
  clusterStatus
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        title={licenseCap ? "Загрузка лицензий" : "Сеансы / лимит"}
        value={effectiveCap ? `${utilizationRate}%` : '—'}
        description={licenseCap
          ? `${totalSessions} / ${licenseCap} · остаток ${remainingLicenses}`
          : (fallbackClientLimit > 0 ? `${totalSessions} / ${fallbackClientLimit} (лимит по клиентам)` : `${totalSessions} (лимит не задан)`)}
        icon={Activity}
        color={utilizationRate >= 90 ? 'orange' : utilizationRate >= 75 ? 'blue' : 'green'}
        hrefHash="#/clients"
      />
      <StatCard
        title="Активные клиенты"
        value={`${activeClientsCount}`}
        description={`Из ${totalClientsCount}`}
        icon={Users}
        color="blue"
        hrefHash="#/clients"
      />
      <StatCard
        title="Предупреждения по квотам"
        value={warningsCount}
        description="80%+ или блокировка"
        icon={AlertTriangle}
        color={warningsCount > 0 ? 'orange' : 'green'}
        hrefHash={warningsCount > 0 ? '#/clients?ops=risk' : '#/clients'}
      />
      <StatCard
        title="Кластер 1С"
        value={clusterStatus === 'online' ? 'Online' : clusterStatus === 'offline' ? 'Offline' : 'Unknown'}
        description="Доступность RAC/RAS"
        icon={Server}
        color={clusterStatus === 'online' ? 'green' : clusterStatus === 'offline' ? 'red' : 'blue'}
        hrefHash={clusterStatus === 'offline' ? '#/events?levels=critical,warning&q=cluster' : '#/settings'}
      />
    </div>
  );
};
