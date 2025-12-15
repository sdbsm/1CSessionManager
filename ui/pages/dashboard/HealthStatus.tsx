import React from 'react';
import { HealthPill } from '../../components/shared/HealthPill';
import { DashboardStats } from '../../hooks/useDashboardData';

interface HealthStatusProps {
  apiHealth: 'ok' | 'unknown';
  stats: DashboardStats | null;
  dbEndpointStatus: 'set' | 'not_set' | 'unknown';
  sqlLoginStatus: 'set' | 'not_set' | 'unknown';
}

export const HealthStatus: React.FC<HealthStatusProps> = ({ 
  apiHealth, 
  stats, 
  dbEndpointStatus, 
  sqlLoginStatus 
}) => {
  const clusterHealth = stats?.clusterStatus === 'online' ? 'ok' : stats?.clusterStatus === 'offline' ? 'fail' : 'unknown';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      <HealthPill label="API управления" status={apiHealth === 'ok' ? 'ok' : 'unknown'} hint="Доступность сервиса управления" />
      <HealthPill label="Кластер 1С" status={clusterHealth} hint={stats?.clusterStatus === 'online' ? 'RAC/RAS доступны' : 'Проверьте RAS host / учётку / rac.exe'} />
      <HealthPill label="Хранилище (SQL)" status={dbEndpointStatus === 'set' ? 'ok' : dbEndpointStatus === 'not_set' ? 'warn' : 'unknown'} hint="SQL Server + база (Windows Credential Manager)" />
      <HealthPill label="SQL учётка" status={sqlLoginStatus === 'set' ? 'ok' : sqlLoginStatus === 'not_set' ? 'warn' : 'unknown'} hint="SQL учётные данные (Windows Credential Manager)" />
    </div>
  );
};
