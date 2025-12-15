import React, { useMemo } from 'react';
import { Users, Activity, Check, AlertTriangle } from 'lucide-react';
import { Client } from '../../types';
import StatCard from '../../components/StatCard';

interface ClientStatsProps {
  clients: Client[];
  unassignedCount: number;
}

export const ClientStats: React.FC<ClientStatsProps> = ({ clients, unassignedCount }) => {
  const stats = useMemo(() => {
    const totalClients = clients.length;
    const totalSessions = clients.reduce((sum, c) => sum + c.activeSessions, 0);
    const activeClients = clients.filter(c => c.status === 'active').length;
    
    return { totalClients, totalSessions, activeClients };
  }, [clients]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Всего клиентов"
        value={stats.totalClients}
        description=""
        icon={Users}
        color="blue"
      />
      <StatCard
        title="Активных сеансов"
        value={stats.totalSessions}
        description="Всего по всем базам"
        icon={Activity}
        color="green"
      />
      <StatCard
        title="Активных клиентов"
        value={stats.activeClients}
        description=""
        icon={Check}
        color="blue"
      />
      <StatCard
        title="Нераспределенных баз"
        value={unassignedCount}
        description="Требуют внимания"
        icon={AlertTriangle}
        color="orange"
      />
    </div>
  );
};
