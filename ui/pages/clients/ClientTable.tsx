import React from 'react';
import { ClientRow } from './ClientRow';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Client, AgentPublicationDto } from '../../types';
import { useUiPrefs } from '../../hooks/useUiPrefs';

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onRemoveDatabase: (clientId: string, dbName: string) => void;
  publications?: AgentPublicationDto[];
  onPublish?: (dbName: string) => void;
  onEditPublication?: (dbName: string, pub: AgentPublicationDto) => void;
  sortBy: 'name' | 'sessions' | 'databases' | 'status';
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: 'name' | 'sessions' | 'databases' | 'status') => void;
  onOpenDetails: (client: Client) => void;
  expandedClientId?: string | null;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  onEdit,
  onDelete,
  onRemoveDatabase,
  publications = [],
  onPublish,
  onEditPublication,
  sortBy,
  sortOrder,
  onSortChange,
  onOpenDetails,
  expandedClientId
}) => {
  const { prefs } = useUiPrefs();
  const renderSortIcon = (field: 'name' | 'sessions' | 'databases' | 'status') => {
    if (sortBy !== field) return null;
    return sortOrder === 'desc'
      ? <ChevronDown size={14} className="ml-1 inline" />
      : <ChevronUp size={14} className="ml-1 inline" />;
  };

  const thPad = prefs.density === 'compact' ? 'px-6 py-2.5' : 'px-6 py-4';

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-white/10">
            <tr>
              <th className={`${thPad} w-12`}> </th>
              <th
                className={`${thPad} cursor-pointer hover:text-slate-200 select-none`}
                onClick={() => onSortChange('name')}
                title="Сортировать по имени"
              >
                Клиент {renderSortIcon('name')}
              </th>
              <th
                className={`${thPad} cursor-pointer hover:text-slate-200 select-none`}
                onClick={() => onSortChange('databases')}
                title="Сортировать по количеству инфобаз"
              >
                Инфобазы {renderSortIcon('databases')}
              </th>
              <th
                className={`${thPad} cursor-pointer hover:text-slate-200 select-none`}
                onClick={() => onSortChange('sessions')}
                title="Сортировать по количеству активных сеансов"
              >
                Сеансы (Факт / План) {renderSortIcon('sessions')}
              </th>
              <th
                className={`${thPad} cursor-pointer hover:text-slate-200 select-none`}
                onClick={() => onSortChange('status')}
                title="Сортировать по статусу"
              >
                Статус {renderSortIcon('status')}
              </th>
              <th className={`${thPad} text-right`}>Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {clients.length > 0 ? (
              clients.map(client => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onOpenDetails={onOpenDetails}
                  onOpenEvents={(clientId) => {
                    const ret = window.location.hash || '#/clients';
                    window.location.hash = `#/events?clientId=${encodeURIComponent(clientId)}&return=${encodeURIComponent(ret)}`;
                  }}
                  onEdit={(c) => onEdit(c)}
                  onDelete={(id) => onDelete(id)}
                  density={prefs.density}
                  isExpanded={client.id === expandedClientId}
                  publications={publications}
                  onRemoveDatabase={(clientId, dbName) => onRemoveDatabase(clientId, dbName)}
                  onPublish={(dbName) => onPublish && onPublish(dbName)}
                  onEditPublication={(dbName, pub) => onEditPublication && onEditPublication(dbName, pub)}
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
