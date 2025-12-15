import React, { useState } from 'react';
import { ClientRow } from './ClientRow';
import { Search } from 'lucide-react';
import { Client, AgentPublicationDto } from '../../types';

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onRemoveDatabase: (clientId: string, dbName: string) => void;
  publications?: AgentPublicationDto[];
  onPublish?: (dbName: string) => void;
  onEditPublication?: (dbName: string, pub: AgentPublicationDto) => void;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  onEdit,
  onDelete,
  onRemoveDatabase,
  publications = [],
  onPublish,
  onEditPublication
}) => {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const toggleExpand = (clientId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedClientId(expandedClientId === clientId ? null : clientId);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-white/10">
            <tr>
              <th className="px-6 py-4 w-12"></th>
              <th className="px-6 py-4">Клиент</th>
              <th className="px-6 py-4">Инфобазы</th>
              <th className="px-6 py-4">Сеансы (Факт / План)</th>
              <th className="px-6 py-4">Статус</th>
              <th className="px-6 py-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {clients.length > 0 ? (
              clients.map(client => (
                <ClientRow
                  key={client.id}
                  client={client}
                  isExpanded={expandedClientId === client.id}
                  onToggleExpand={(e) => toggleExpand(client.id, e)}
                  onEdit={(e) => {
                    e.stopPropagation();
                    onEdit(client);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    onDelete(client.id);
                  }}
                  onRemoveDatabase={onRemoveDatabase}
                  publications={publications}
                  onPublish={onPublish}
                  onEditPublication={onEditPublication}
                />
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={32} className="text-slate-600" />
                    <p>Клиенты не найдены</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
