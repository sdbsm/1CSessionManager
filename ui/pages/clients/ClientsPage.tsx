import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, ArrowUpDown } from 'lucide-react';
import { Client, AgentPublicationDto } from '../../types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { ClientTable } from './ClientTable';
import { ClientModal } from './ClientModal';
import { ClientStats } from './ClientStats';
import { UnassignedDatabases } from './UnassignedDatabases';
import { useInfobases } from '../../hooks/useInfobases';
import { useSettings } from '../../hooks/useSettings';
import { apiFetch } from '../../services/apiClient';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';

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

  // Mass Update State
  const [isMassModalOpen, setMassModalOpen] = useState(false);
  const [massSource, setMassSource] = useState('');
  const [massTarget, setMassTarget] = useState('');
  
  // Publish Modal State
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [pubDbName, setPubDbName] = useState('');
  const [pubName, setPubName] = useState('');
  const [pubPath, setPubPath] = useState('C:\\inetpub\\wwwroot\\');
  const [pubVer, setPubVer] = useState('');
  // New state to track if we are editing an existing publication
  const [isEditingPub, setIsEditingPub] = useState(false);

  // Settings for publications
  const { settings, agentId } = useSettings();
  const versions = settings?.installedVersionsJson ? JSON.parse(settings.installedVersionsJson) as string[] : [];
  const publications = settings?.publications || [];

  useEffect(() => {
    if (settings?.defaultOneCVersion && !pubVer) {
      setMassTarget(settings.defaultOneCVersion);
      setPubVer(settings.defaultOneCVersion);
    }
  }, [settings, pubVer]);

  const sendCommand = async (type: string, payload: any) => {
    if (!agentId) return;
    try {
      await apiFetch(`/api/agents/${agentId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payloadJson: JSON.stringify(payload) })
      });
      alert('Команда отправлена агенту. Статус обновится через минуту.');
    } catch (e: any) {
      alert('Ошибка: ' + e.message);
    }
  };

  const handleMassUpdate = () => {
    if (!massTarget) return; // Only target is required now
    sendCommand('MassUpdateVersions', {
      SourceVersion: massSource,
      TargetVersion: massTarget
    });
    setMassModalOpen(false);
  };

  const handlePublishClick = (dbName: string) => {
    setPubDbName(dbName);
    setPubName(dbName); // Default pub name = db name
    setPubPath(`C:\\inetpub\\wwwroot\\${dbName}`);
    if (settings?.defaultOneCVersion) {
        setPubVer(settings.defaultOneCVersion);
    }
    setIsEditingPub(false);
    setIsPubModalOpen(true);
  };

  const handleEditPublication = (dbName: string, pub: AgentPublicationDto) => {
    setPubDbName(dbName);
    setPubName(pub.siteName); // siteName usually corresponds to the URL path part if structured correctly, or we use AppPath without slash
    // AppPath is usually "/baseName", so we strip slash
    const derivedName = pub.appPath.startsWith('/') ? pub.appPath.substring(1) : pub.appPath;
    setPubName(derivedName || pub.siteName); 
    setPubPath(pub.physicalPath);
    setPubVer(pub.version || settings?.defaultOneCVersion || '');
    setIsEditingPub(true);
    setIsPubModalOpen(true);
  };

  const handlePublishSubmit = () => {
    if (!pubName || !pubPath || !pubVer) return;
    
    // Construct AppPath (usually /Name)
    const appPath = pubName.startsWith('/') ? pubName : `/${pubName}`;

    sendCommand('Publish', {
      SiteName: "Default Web Site", // Default IIS site, or make it configurable if needed? existing code used SiteName from DTO but "Default Web Site" implicitly for new ones. 
      // Actually, existing code used 'BaseName' which backend mapped to AppPath/Name.
      // Let's stick to what worked or what is expected.
      // Based on previous PublicationsSection:
      // New: BaseName, FolderPath, ConnectionString, Version
      // Edit: SiteName, BaseName (AppPath), Version, FolderPath, ConnectionString
      
      // If we are editing, we should probably preserve the SiteName if possible, but the backend 'Publish' command
      // might expect 'BaseName' to be the app name.
      
      BaseName: pubName, 
      FolderPath: pubPath,
      ConnectionString: `Srvr="localhost";Ref="${pubDbName}";`,
      Version: pubVer
    });
    setIsPubModalOpen(false);
  };

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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMassModalOpen(true)}>
               🔄 Массовая смена платформы
            </Button>
            <Button onClick={handleOpenAdd} icon={<Plus size={18} />}>
              Добавить клиента
            </Button>
          </div>
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
          publications={publications}
          onPublish={handlePublishClick}
          onEditPublication={handleEditPublication}
        />
      </div>

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingClient={editingClient}
        onSave={handleSaveClient}
        clients={clients}
      />

      {/* Mass Update Modal */}
      <Modal 
        isOpen={isMassModalOpen} 
        onClose={() => setMassModalOpen(false)} 
        title="Массовая смена платформы"
      >
        <div className="space-y-4">
            <p className="text-sm text-slate-400">
                Переключение всех публикаций с одной версии на другую.
            </p>
            <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-300">Исходная версия (откуда)</label>
                <Select 
                    value={massSource} 
                    onChange={e => setMassSource(e.target.value)}
                    options={[{value:'', label:'Все (любая версия)'}, ...versions.map(v => ({ value: v, label: v }))]}
                />
            </div>
            <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-300">Целевая версия (куда)</label>
                <Select 
                    value={massTarget} 
                    onChange={e => setMassTarget(e.target.value)}
                    options={[{value:'', label:'--'}, ...versions.map(v => ({ value: v, label: v }))]}
                />
            </div>
            <div className="pt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setMassModalOpen(false)}>Отмена</Button>
                <Button onClick={handleMassUpdate}>Запустить</Button>
            </div>
        </div>
      </Modal>

      {/* Publish Modal */}
      <Modal
        isOpen={isPubModalOpen}
        onClose={() => setIsPubModalOpen(false)}
        title={isEditingPub ? `Настройки публикации: ${pubDbName}` : `Новая публикация: ${pubDbName}`}
      >
        <div className="space-y-4">
            <Input label="Имя публикации (URL path)" value={pubName} onChange={e => setPubName(e.target.value)} />
            <Input label="Путь к папке (Physical Path)" value={pubPath} onChange={e => setPubPath(e.target.value)} />
            
            <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-300">Версия платформы</label>
                <Select 
                    value={pubVer} 
                    onChange={e => setPubVer(e.target.value)}
                    options={versions.map(v => ({ value: v, label: v }))}
                />
            </div>

            <div className="pt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsPubModalOpen(false)}>Отмена</Button>
                <Button onClick={handlePublishSubmit}>
                    {isEditingPub ? 'Сохранить изменения' : 'Опубликовать'}
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;
