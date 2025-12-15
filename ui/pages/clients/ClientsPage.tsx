import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, ArrowUpDown } from 'lucide-react';
import { Client } from '../../types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { ClientTable } from './ClientTable';
import { ClientModal } from './ClientModal';
import { ClientStats } from './ClientStats';
import { UnassignedDatabases } from './UnassignedDatabases';
import { useInfobases } from '../../hooks/useInfobases';

interface ClientsProps {
  clients: Client[];
  onAdd: (client: Omit<Client, 'id'>) => void;
  onUpdate: (client: Client) => void;
  onDelete: (id: string) => void;
}

type StatusFilter = 'all' | 'active' | 'blocked' | 'warning';
type LimitFilter = 'all' | 'limited' | 'unlimited';

const Clients: React.FC<ClientsProps> = ({ clients, onAdd, onUpdate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [limitFilter, setLimitFilter] = useState<LimitFilter>('all');
  const [sortBy, setSortBy] = useState<'name' | 'sessions' | 'databases' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Unassigned databases
  const { availableDbs, loading: loadingDbs, fetchDatabases } = useInfobases();
  const [unassignedDatabases, setUnassignedDatabases] = useState<{name: string, uuid: string}[]>([]);

  // Calculate unassigned databases
  useEffect(() => {
    const assignedDbNames = new Set(
      clients.flatMap(client => client.databases.map(db => db.name))
    );
    const unassigned = availableDbs.filter(
      db => !assignedDbNames.has(db.name)
    );
    setUnassignedDatabases(unassigned);
  }, [clients, availableDbs]);

  // Filtered and sorted clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clients.filter(c => {
      // Search filter
      const matchesSearch = !searchTerm || 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.databases.some(db => db.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      
      // Limit filter
      const matchesLimit = limitFilter === 'all' || 
        (limitFilter === 'limited' && c.maxSessions > 0) ||
        (limitFilter === 'unlimited' && c.maxSessions === 0);
      
      return matchesSearch && matchesStatus && matchesLimit;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'sessions':
          aVal = a.activeSessions;
          bVal = b.activeSessions;
          break;
        case 'databases':
          aVal = a.databases.length;
          bVal = b.databases.length;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [clients, searchTerm, statusFilter, limitFilter, sortBy, sortOrder]);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleRemoveDatabase = (clientId: string, dbName: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const updatedClient = {
      ...client,
      databases: client.databases.filter(db => db.name !== dbName),
      activeSessions: client.databases
        .filter(db => db.name !== dbName)
        .reduce((sum, db) => sum + db.activeSessions, 0)
    };
    
    onUpdate(updatedClient);
  };

  const handleQuickAssign = (dbName: string, clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    if (client.databases.some(db => db.name === dbName)) {
      alert('База уже привязана к этому клиенту');
      return;
    }
    
    const assignedToOtherClient = clients.find(c => 
      c.id !== clientId && c.databases.some(db => db.name === dbName)
    );
    
    if (assignedToOtherClient) {
      alert(`База данных "${dbName}" уже привязана к клиенту "${assignedToOtherClient.name}".\n\nКаждая база может быть привязана только к одному клиенту.`);
      return;
    }
    
    const updatedClient = {
      ...client,
      databases: [...client.databases, { name: dbName, activeSessions: 0 }]
    };
    
    onUpdate(updatedClient);
  };

  const handleSaveClient = (clientData: any) => {
    if (editingClient) {
      onUpdate({
        ...editingClient,
        ...clientData
      });
    } else {
      onAdd(clientData);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <PageHeader 
        title="Клиенты и Лимиты"
        description="Управление базами данных и квотами сеансов"
        actions={
          <Button onClick={handleOpenAdd} icon={<Plus size={18} />}>
            Добавить клиента
          </Button>
        }
      />

      <ClientStats clients={clients} unassignedCount={unassignedDatabases.length} />

      <UnassignedDatabases 
        unassignedDatabases={unassignedDatabases}
        clients={clients}
        onAssign={handleQuickAssign}
        onRefresh={fetchDatabases}
        loading={loadingDbs}
      />

      {/* Search and Filters Card */}
      <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-slate-950/40">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по названию клиента или базе данных..." 
                className="pl-10 !bg-white/5 !border-white/10 !text-slate-100"
                fullWidth
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={16} className="text-slate-500" />
              {[
                { id: 'all', label: 'Все' },
                { id: 'active', label: 'Активные' },
                { id: 'blocked', label: 'Заблокированные' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.id 
                      ? (f.id === 'active' ? 'bg-green-600 text-white' : f.id === 'blocked' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white')
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
                  onClick={() => setLimitFilter(limitFilter === f.id ? 'all' : f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    limitFilter === f.id 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Найдено клиентов: <b className="text-slate-200">{filteredAndSortedClients.length}</b></span>
            <div className="flex items-center gap-2">
              <span>Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs border border-white/10 bg-white/5 rounded px-2 py-1 text-slate-100"
              >
                <option value="name" className="bg-slate-900">По имени</option>
                <option value="sessions" className="bg-slate-900">По сеансам</option>
                <option value="databases" className="bg-slate-900">По базам</option>
                <option value="status" className="bg-slate-900">По статусу</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-white/5 rounded"
                title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>
          </div>
        </div>
        
        <ClientTable 
          clients={filteredAndSortedClients}
          onEdit={handleOpenEdit}
          onDelete={onDelete}
          onRemoveDatabase={handleRemoveDatabase}
        />
      </div>

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingClient={editingClient}
        onSave={handleSaveClient}
        clients={clients}
      />
    </div>
  );
};

export default Clients;
