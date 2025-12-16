import React from 'react';
import { UnassignedDatabases } from '../UnassignedDatabases';
import { Client } from '../../../types';

interface InfobasesViewProps {
  unassignedDatabases: { name: string, uuid: string }[];
  clients: Client[];
  onAssign: (dbName: string, clientId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const InfobasesView: React.FC<InfobasesViewProps> = ({
  unassignedDatabases,
  clients,
  onAssign,
  onRefresh,
  loading
}) => {
  return (
    <>
      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300 mb-6">
        Здесь — операционные задачи по инфобазам: найти нераспределённые и быстро назначить клиентам.
      </div>
      <UnassignedDatabases 
        unassignedDatabases={unassignedDatabases}
        clients={clients}
        onAssign={onAssign}
        onRefresh={onRefresh}
        loading={loading}
      />
    </>
  );
};
