import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { Client, AgentPublicationDto, StatusFilter, LimitFilter, OpsFilter } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
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
  expandedClientId?: string | null;
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
  publications,
  expandedClientId
}) => {
  return (
    <>
      <ClientStats clients={clients} unassignedCount={unassignedCount} />

      <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden mt-6">
        <div className="p-4 border-b border-white/10 bg-slate-950/40">
          <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
            <div className="relative flex-1 min-w-[200px] w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <Input 
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск по названию клиента или инфобазе..." 
                className="pl-10 !bg-white/5 !border-white/10 !text-slate-100"
                fullWidth
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <Select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
                options={[
                    { value: 'all', label: 'Все статусы' },
                    { value: 'active', label: 'Активные' },
                    { value: 'warning', label: 'Внимание' },
                    { value: 'blocked', label: 'Заблокированные' }
                ]}
                className="w-40"
                fullWidth={false}
              />

              <Select
                value={limitFilter}
                onChange={(e) => onLimitFilterChange(e.target.value as LimitFilter)}
                options={[
                    { value: 'all', label: 'Любой лимит' },
                    { value: 'limited', label: 'С лимитом' },
                    { value: 'unlimited', label: 'Безлимитные' }
                ]}
                className="w-40"
                fullWidth={false}
              />

              <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block"></div>
              
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                {[
                  { id: 'risk', label: 'Риск', activeClass: 'bg-amber-600 text-white', title: 'Клиенты с лимитом: загрузка 80–99%' },
                  { id: 'over', label: 'Перелимит', activeClass: 'bg-rose-600 text-white', title: 'Клиенты с лимитом: факт ≥ план' },
                  { id: 'noDbs', label: 'Нет баз', activeClass: 'bg-slate-700 text-white', title: 'Клиенты без привязанных инфобаз' },
                  { id: 'noPubs', label: 'Нет Web', activeClass: 'bg-indigo-600 text-white', title: 'Есть инфобазы, но нет Web‑публикаций' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => onToggleOpsFilter(f.id as OpsFilter)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      opsFilters.has(f.id as OpsFilter)
                        ? f.activeClass
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={f.title}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto xl:ml-0">
                <button
                    type="button"
                    onClick={() => onRefresh?.()}
                    className="p-2 rounded-lg transition-colors bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    title="Обновить данные"
                >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>
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
          expandedClientId={expandedClientId}
        />
      </div>
    </>
  );
};
