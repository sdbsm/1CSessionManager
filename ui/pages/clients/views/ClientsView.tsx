import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { Client, AgentPublicationDto, StatusFilter, LimitFilter, OpsFilter } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { ClientTable } from '../ClientTable';
import { ClientStats } from '../ClientStats';
import { formatRelativeShort } from '../../../utils/time';

interface ClientsViewProps {
  clients: Client[];
  filteredAndSortedClients: Client[];
  unassignedCount: number;
  
  // Filters
  searchTerm: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  limitFilter: LimitFilter;
  onLimitFilterChange: (v: LimitFilter) => void;
  opsFilters: Set<OpsFilter>;
  onToggleOpsFilter: (v: OpsFilter) => void;
  
  // State
  lastUpdate?: Date;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  
  // Actions
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onRemoveDatabase: (clientId: string, dbName: string) => void;
  onPublish: (dbName: string) => void;
  onEditPublication: (dbName: string, pub: AgentPublicationDto) => void;
  onOpenDetails: (client: Client) => void;
  
  // Sorting
  sortBy: 'name' | 'sessions' | 'databases' | 'status';
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: 'name' | 'sessions' | 'databases' | 'status') => void;
  
  publications: AgentPublicationDto[];
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  filteredAndSortedClients,
  unassignedCount,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  limitFilter,
  onLimitFilterChange,
  opsFilters,
  onToggleOpsFilter,
  lastUpdate,
  isRefreshing,
  onRefresh,
  onEdit,
  onDelete,
  onRemoveDatabase,
  onPublish,
  onEditPublication,
  onOpenDetails,
  sortBy,
  sortOrder,
  onSortChange,
  publications
}) => {
  return (
    <>
      <ClientStats clients={clients} unassignedCount={unassignedCount} />

      <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden mt-6">
        <div className="p-4 border-b border-white/10 bg-slate-950/40">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <Input 
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск по названию клиента или инфобазе..." 
                className="pl-10 !bg-white/5 !border-white/10 !text-slate-100"
                fullWidth
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={16} className="text-slate-500" />
              {[
                { id: 'all', label: 'Все' },
                { id: 'active', label: 'Активные' },
                { id: 'warning', label: 'Внимание' },
                { id: 'blocked', label: 'Заблокированные' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => onStatusFilterChange(f.id as StatusFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.id 
                      ? (f.id === 'active' ? 'bg-green-600 text-white' : f.id === 'blocked' ? 'bg-red-600 text-white' : f.id === 'warning' ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white')
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              {[
                { id: 'limited', label: 'С лимитом' },
                { id: 'unlimited', label: 'Безлимитные' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => onLimitFilterChange(limitFilter === f.id ? 'all' : f.id as LimitFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    limitFilter === f.id 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              {[
                { id: 'risk', label: 'В риске ≥80%', activeClass: 'bg-amber-600 text-white', title: 'Клиенты с лимитом: загрузка 80–99%' },
                { id: 'over', label: 'Перелимит', activeClass: 'bg-rose-600 text-white', title: 'Клиенты с лимитом: факт ≥ план' },
                { id: 'noDbs', label: 'Без инфобаз', activeClass: 'bg-slate-700 text-white', title: 'Клиенты без привязанных инфобаз' },
                { id: 'noPubs', label: 'Без публикаций', activeClass: 'bg-indigo-600 text-white', title: 'Есть инфобазы, но нет Web‑публикаций' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => onToggleOpsFilter(f.id as OpsFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    opsFilters.has(f.id as OpsFilter)
                      ? f.activeClass
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  title={f.title}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              <button
                type="button"
                onClick={() => onRefresh?.()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-white/5 text-slate-200 hover:bg-white/10 inline-flex items-center gap-2"
                title="Обновить клиентов"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                Обновить
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Найдено клиентов: <b className="text-slate-200">{filteredAndSortedClients.length}</b></span>
            <div className="flex items-center gap-2">
              <span>{lastUpdate && lastUpdate.getTime() > 0 ? `Обновлено: ${formatRelativeShort(lastUpdate)}` : ''}</span>
            </div>
          </div>
        </div>
        
        <ClientTable 
          clients={filteredAndSortedClients}
          onEdit={onEdit}
          onDelete={onDelete}
          onRemoveDatabase={onRemoveDatabase}
          publications={publications}
          onPublish={onPublish}
          onEditPublication={onEditPublication}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          onOpenDetails={onOpenDetails}
        />
      </div>
    </>
  );
};
