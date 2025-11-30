import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientDatabase } from '../types';
import { 
  Search, 
  Plus, 
  Database, 
  Pencil, 
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Server,
  Check,
  Loader2,
  AlertTriangle,
  UserPlus,
  Users,
  Activity,
  Filter,
  XCircle,
  ArrowUpDown,
  Eye,
  EyeOff
} from 'lucide-react';

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
  
  // Expandable Row State
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [modalTab, setModalTab] = useState<'info' | 'databases'>('info');

  // DB selection state
  const [availableDbs, setAvailableDbs] = useState<{name: string, uuid: string}[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  
  // Unassigned databases state
  const [unassignedDatabases, setUnassignedDatabases] = useState<{name: string, uuid: string}[]>([]);
  const [assigningDb, setAssigningDb] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    maxSessions: 10,
    status: 'active' as Client['status']
  });
  
  // Dedicated state for the DB input string
  const [manualDbInput, setManualDbInput] = useState('');

  const fetchDatabases = () => {
    setLoadingDbs(true);
    fetch('/api/infobases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
            setAvailableDbs(data);
        } else {
            setAvailableDbs([]);
        }
        setLoadingDbs(false);
      })
      .catch(err => {
        console.error("Failed to load DBs", err);
        setAvailableDbs([]); 
        setLoadingDbs(false);
      });
  };

  // Fetch databases on mount
  useEffect(() => {
    fetchDatabases();
  }, []);

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

  // Statistics
  const stats = useMemo(() => {
    const totalClients = clients.length;
    const totalSessions = clients.reduce((sum, c) => sum + c.activeSessions, 0);
    const unassignedCount = unassignedDatabases.length;
    const activeClients = clients.filter(c => c.status === 'active').length;
    
    return { totalClients, totalSessions, unassignedCount, activeClients };
  }, [clients, unassignedDatabases]);

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

  // Group clients by status
  const groupedClients = useMemo(() => {
    const groups: Record<string, typeof filteredAndSortedClients> = {
      active: [],
      blocked: [],
      warning: []
    };
    
    filteredAndSortedClients.forEach(client => {
      groups[client.status].push(client);
    });
    
    return groups;
  }, [filteredAndSortedClients]);

  const toggleExpand = (clientId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedClientId(expandedClientId === clientId ? null : clientId);
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      maxSessions: 10,
      status: 'active'
    });
    setManualDbInput('');
    setModalTab('info');
    setIsModalOpen(true);
    fetchDatabases();
  };

  const handleOpenEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setEditingClient(client);
    setFormData({
      name: client.name,
      maxSessions: client.maxSessions,
      status: client.status
    });
    setManualDbInput(client.databases.map(d => d.name).join(', '));
    setModalTab('info');
    setIsModalOpen(true);
    fetchDatabases();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    onDelete(id);
  };

  const handleRemoveDatabase = (clientId: string, dbName: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const toggleDatabaseSelection = (dbName: string) => {
    // Проверка: база уже привязана к другому клиенту
    const assignedToOtherClient = clients.find(c => {
      // При редактировании исключаем текущего клиента
      if (editingClient && c.id === editingClient.id) return false;
      return c.databases.some(d => d.name === dbName);
    });
    
    if (assignedToOtherClient) {
      alert(`База данных "${dbName}" уже привязана к клиенту "${assignedToOtherClient.name}".\n\nКаждая база может быть привязана только к одному клиенту.`);
      return;
    }
    
    const currentList = manualDbInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    const exists = currentList.includes(dbName);
    
    let newList;
    if (exists) {
      newList = currentList.filter(d => d !== dbName);
    } else {
      newList = [...currentList, dbName];
    }
    
    setManualDbInput(newList.join(', '));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const dbNames = manualDbInput
        .split(/[\n,]+/) 
        .map(s => s.trim())
        .filter(s => s !== '');

    const uniqueDbNames = Array.from(new Set(dbNames));

    // Проверка: база не должна быть привязана к другому клиенту
    const conflictingDbs: string[] = [];
    uniqueDbNames.forEach(dbName => {
      const assignedToClient = clients.find(c => {
        // При редактировании исключаем текущего клиента
        if (editingClient && c.id === editingClient.id) return false;
        return c.databases.some(d => d.name === dbName);
      });
      
      if (assignedToClient) {
        conflictingDbs.push(dbName);
      }
    });

    if (conflictingDbs.length > 0) {
      alert(`Следующие базы данных уже привязаны к другим клиентам:\n${conflictingDbs.join(', ')}\n\nКаждая база может быть привязана только к одному клиенту.`);
      return;
    }

    const newDatabases: ClientDatabase[] = uniqueDbNames.map(name => {
      const existing = editingClient?.databases.find(d => d.name === name);
      return {
        name,
        activeSessions: existing ? existing.activeSessions : 0
      };
    });

    const totalActive = newDatabases.reduce((sum, db) => sum + db.activeSessions, 0);

    const clientData = {
      name: formData.name,
      maxSessions: formData.maxSessions,
      status: formData.status,
      databases: newDatabases,
      activeSessions: totalActive
    };

    if (editingClient) {
      onUpdate({
        ...editingClient,
        ...clientData
      });
    } else {
      onAdd(clientData);
    }
    setIsModalOpen(false);
  };

  const isDbSelectedInText = (dbName: string) => {
      const currentList = manualDbInput.split(/[\n,]+/).map(s => s.trim());
      return currentList.includes(dbName);
  };

  const filteredAvailableDbs = availableDbs.filter(db => 
    db.name.toLowerCase().includes(dbSearch.toLowerCase())
  );

  // Quick assign database to client
  const handleQuickAssign = (dbName: string, clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    // Проверка: база уже привязана к этому клиенту
    if (client.databases.some(db => db.name === dbName)) {
      alert('База уже привязана к этому клиенту');
      return;
    }
    
    // Проверка: база привязана к другому клиенту
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
    setAssigningDb(null);
  };

  const renderClientRow = (client: Client) => {
                const isUnlimited = client.maxSessions === 0;
                const percentage = !isUnlimited 
                  ? Math.round((client.activeSessions / client.maxSessions) * 100) 
                  : 0;
                const isCritical = !isUnlimited && percentage >= 100;
                const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;
                const isExpanded = expandedClientId === client.id;
    const previewDbs = client.databases.slice(0, 2);
    const remainingDbs = client.databases.length - previewDbs.length;

                return (
                  <React.Fragment key={client.id}>
        <tr className={`group transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
            <button
              onClick={(e) => toggleExpand(client.id, e)}
              className="text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {isExpanded ? <ChevronUp size={18} className="text-indigo-600" /> : <ChevronDown size={18} />}
            </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{client.name}</div>
                      </td>
                      <td className="px-6 py-4">
            <div className="flex items-center gap-2 flex-wrap">
              {previewDbs.length > 0 ? (
                <>
                  {previewDbs.map((db, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">
                      <Database size={12} />
                      <span className="truncate max-w-[120px]">{db.name}</span>
                      {db.activeSessions > 0 && (
                        <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                          {db.activeSessions}
                        </span>
                      )}
                    </span>
                  ))}
                  {remainingDbs > 0 && (
                    <button
                      onClick={(e) => toggleExpand(client.id, e)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      +{remainingDbs} еще
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-400 italic">Нет баз данных</span>
              )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
            <div className="w-full max-w-[180px]">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-slate-700">
                              {client.activeSessions} / {isUnlimited ? '∞' : client.maxSessions}
                            </span>
                            {!isUnlimited && (
                  <span className={`font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-green-600'}`}>
                                {percentage}%
                              </span>
                            )}
                          </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            {isUnlimited ? (
                              <div className="h-full w-full bg-gradient-to-r from-indigo-300 to-indigo-500 opacity-50" />
                            ) : (
                              <div 
                    className={`h-full rounded-full transition-all ${
                                  isCritical ? 'bg-red-500' : 
                                  isWarning ? 'bg-orange-400' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          client.status === 'active' ? 'bg-green-100 text-green-800' :
                          client.status === 'blocked' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {client.status === 'active' ? 'Активен' : client.status === 'blocked' ? 'Блокировка' : 'Внимание'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => handleOpenEdit(client, e)}
                className="text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded-md transition-colors" 
                            title="Редактировать"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(client.id, e)}
                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-indigo-50/30 border-b border-indigo-100">
            <td colSpan={6} className="px-6 py-6">
              <div className="ml-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Database size={16} />
                  Все базы данных ({client.databases.length})
                            </h4>
                            {client.databases.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {client.databases.map((db, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-lg border border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 text-sm truncate" title={db.name}>
                              {db.name}
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleRemoveDatabase(client.id, db.name, e)}
                            className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
                            title="Удалить базу"
                          >
                            <XCircle size={14} />
                          </button>
                                    </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-500 uppercase font-semibold">Активных сеансов</span>
                          <span className={`text-lg font-bold ${db.activeSessions > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {db.activeSessions}
                          </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-400 italic">Базы данных не привязаны.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header with Statistics */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Клиенты и Лимиты</h1>
            <p className="text-slate-500">Управление базами данных и квотами сеансов</p>
          </div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Plus size={18} />
            <span>Добавить клиента</span>
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Всего клиентов</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalClients}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Users size={24} className="text-indigo-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Активных сеансов</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalSessions}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity size={24} className="text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Активных клиентов</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.activeClients}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Check size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Нераспределенных баз</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.unassignedCount}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned Databases Card */}
      {unassignedDatabases.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-amber-700" />
              <h3 className="font-semibold text-slate-800">Нераспределенные базы данных</h3>
              <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-full text-xs font-bold">
                {unassignedDatabases.length}
              </span>
            </div>
            <button
              onClick={fetchDatabases}
              className="text-amber-700 hover:text-amber-900 p-1.5 hover:bg-amber-200 rounded-md transition-colors"
              title="Обновить список"
            >
              <Loader2 size={16} />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {unassignedDatabases.map((db) => (
                <div key={db.uuid} className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="truncate pr-2 flex-1" title={db.name}>
                      <span className="text-sm font-medium text-slate-700 block truncate">{db.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assigningDb === db.name ? (
                      <select
                        className="flex-1 text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickAssign(db.name, e.target.value);
                          }
                        }}
                        onBlur={() => setAssigningDb(null)}
                        autoFocus
                      >
                        <option value="">Выберите клиента...</option>
                        {clients
                          .filter(client => !client.databases.some(d => d.name === db.name))
                          .map(client => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        {clients.filter(client => !client.databases.some(d => d.name === db.name)).length === 0 && (
                          <option value="" disabled>Все клиенты уже имеют эту базу</option>
                        )}
                      </select>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssigningDb(db.name);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors"
                      >
                        <UserPlus size={12} />
                        Присвоить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по названию клиента или базе данных..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={16} className="text-slate-400" />
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'all' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'active' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Активные
              </button>
              <button
                onClick={() => setStatusFilter('blocked')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'blocked' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Заблокированные
              </button>
              <button
                onClick={() => setLimitFilter(limitFilter === 'limited' ? 'all' : 'limited')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  limitFilter === 'limited' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                С лимитом
              </button>
              <button
                onClick={() => setLimitFilter(limitFilter === 'unlimited' ? 'all' : 'unlimited')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  limitFilter === 'unlimited' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Безлимитные
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Найдено клиентов: <b className="text-slate-700">{filteredAndSortedClients.length}</b></span>
            <div className="flex items-center gap-2">
              <span>Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs border border-slate-300 rounded px-2 py-1"
              >
                <option value="name">По имени</option>
                <option value="sessions">По сеансам</option>
                <option value="databases">По базам</option>
                <option value="status">По статусу</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-slate-100 rounded"
                title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Client Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4">Клиент</th>
                <th className="px-6 py-4">Инфобазы</th>
                <th className="px-6 py-4">Сеансы (Факт / План)</th>
                <th className="px-6 py-4">Статус</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSortedClients.length > 0 ? (
                filteredAndSortedClients.map(client => renderClientRow(client))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-slate-300" />
                      <p>Клиенты не найдены</p>
                      {(searchTerm || statusFilter !== 'all' || limitFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('all');
                            setLimitFilter('all');
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 mt-2"
                        >
                          Сбросить фильтры
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal (Add/Edit Client) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingClient ? 'Редактирование клиента' : 'Новый клиент'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setModalTab('info')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  modalTab === 'info'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Основная информация
              </button>
              <button
                onClick={() => setModalTab('databases')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  modalTab === 'databases'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Базы данных
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                <form id="clientForm" onSubmit={handleSubmit} className="space-y-6">
                {modalTab === 'info' ? (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Название организации</label>
                        <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder='ООО "Вектор"'
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Лимит сеансов 
                          <span className="ml-2 text-xs text-indigo-600 font-normal">(0 = Безлимит)</span>
                        </label>
                        <input 
                        type="number" 
                        required
                        min="0"
                        value={formData.maxSessions}
                        onChange={e => setFormData({...formData, maxSessions: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                    <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as Client['status']})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                    <option value="active">Активен</option>
                    <option value="warning">Внимание (Warning)</option>
                    <option value="blocked">Заблокирован</option>
                    </select>
                </div>
                  </>
                ) : (
                <div className="border-t border-slate-100 pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Привязка информационных баз</label>
                    
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text" 
                                value={dbSearch}
                                onChange={(e) => setDbSearch(e.target.value)}
                                  placeholder="Поиск баз данных..." 
                                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                        </div>

                          <div className="h-64 overflow-y-auto custom-scrollbar space-y-1 bg-white border border-slate-200 rounded-md p-2">
                            {loadingDbs ? (
                                <div className="flex justify-center items-center h-full text-slate-400 text-xs">
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    Загрузка списка баз с сервера 1С...
                                </div>
                            ) : filteredAvailableDbs.length > 0 ? (
                                filteredAvailableDbs.map(db => {
                                    const isSelected = isDbSelectedInText(db.name);
                                      // Проверяем, привязана ли база к другому клиенту (не текущему при редактировании)
                                      const assignedToClient = clients.find(c => {
                                        if (editingClient && c.id === editingClient.id) return false;
                                        return c.databases.some(d => d.name === db.name);
                                      });
                                      const isAssigned = !!assignedToClient;
                                      
                                    return (
                                        <div 
                                            key={db.uuid} 
                                              onClick={() => !isAssigned && toggleDatabaseSelection(db.name)}
                                              className={`flex items-center p-2 rounded-md transition-colors text-sm ${
                                                  isSelected 
                                                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-100' 
                                                    : isAssigned
                                                    ? 'bg-red-50 text-red-600 border border-red-200 cursor-not-allowed'
                                                    : 'hover:bg-slate-50 text-slate-700 cursor-pointer'
                                              }`}
                                              title={isAssigned ? `База уже привязана к клиенту "${assignedToClient?.name}"` : ''}
                                        >
                                              <div className={`w-4 h-4 mr-3 rounded border flex items-center justify-center flex-shrink-0 ${
                                                  isSelected 
                                                    ? 'bg-indigo-600 border-indigo-600' 
                                                    : isAssigned
                                                    ? 'border-red-300 bg-red-100'
                                                    : 'border-slate-300 bg-white'
                                              }`}>
                                                {isSelected && <Check size={10} className="text-white" />}
                                                  {isAssigned && !isSelected && <X size={10} className="text-red-500" />}
                                            </div>
                                            <span className="flex-1 truncate">{db.name}</span>
                                              {isAssigned && assignedToClient && (
                                                  <span className="text-xs text-red-600 ml-2 font-medium flex-shrink-0">
                                                    → {assignedToClient.name}
                                                  </span>
                                              )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs p-4 text-center">
                                    <Database size={24} className="mb-2 opacity-20" />
                                    {availableDbs.length === 0 ? 'Нет соединения с 1С или список пуст.' : 'Базы не найдены.'}
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Список баз данных (вручную):
                            </label>
                            <p className="text-xs text-slate-400 mb-2">
                                Введите названия баз, разделяя их запятыми или с новой строки.
                            </p>
                            <textarea 
                                value={manualDbInput}
                                onChange={e => setManualDbInput(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono"
                                placeholder="Base1, Base2, Base3..."
                                rows={3}
                            />
                        </div>
                        
                        <div className="mt-2 flex justify-between text-xs text-slate-500">
                            <span>Найдено баз: <b>{manualDbInput.split(/[\n,]+/).filter(s=>s.trim()).length}</b></span>
                            {loadingDbs && <span>Синхронизация...</span>}
                        </div>
                    </div>
                </div>
                )}
                </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  form="clientForm"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  {editingClient ? 'Сохранить изменения' : 'Создать клиента'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
