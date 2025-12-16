import React, { useState, useMemo, useEffect } from 'react';
import { Save, Trash2, Plus } from 'lucide-react';
import { Client, AgentPublicationDto, StatusFilter, LimitFilter, OpsFilter, PublicationsRoute } from '../../types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { ClientModal } from './ClientModal';
import { useInfobases } from '../../hooks/useInfobases';
import { useSettings } from '../../hooks/useSettings';
import { apiFetchJson } from '../../services/apiClient';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { downloadText } from '../../utils/download';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { useSavedClientsViews } from '../../hooks/useSavedClientsViews';
import { formatRelativeShort } from '../../utils/time';

// Views
import { ClientsView } from './views/ClientsView';
import { InfobasesView } from './views/InfobasesView';
import { PublicationsView } from './views/PublicationsView';

interface ClientsProps {
  clients: Client[];
  onAdd: (client: Omit<Client, 'id'>) => void;
  onUpdate: (client: Client) => void;
  onDelete: (id: string) => void;
  lastUpdate?: Date;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

type ClientsViewType = 'clients' | 'infobases' | 'publications';

const Clients: React.FC<ClientsProps> = ({ clients, onAdd, onUpdate, onDelete, lastUpdate, isRefreshing, onRefresh }) => {
  const toast = useToast();
  const savedViews = useSavedClientsViews();
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [deleteViewOpen, setDeleteViewOpen] = useState(false);
  const [savedViewName, setSavedViewName] = useState('');
  
  const [view, setView] = useState<ClientsViewType>('clients');
  
  // Clients Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [limitFilter, setLimitFilter] = useState<LimitFilter>('all');
  const [opsFilters, setOpsFilters] = useState<Set<OpsFilter>>(() => new Set());
  const [sortBy, setSortBy] = useState<'name' | 'sessions' | 'databases' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Publications Filters
  const [pubSearch, setPubSearch] = useState('');
  const [pubVersion, setPubVersion] = useState('');
  const [pubSite, setPubSite] = useState('');
  const [pubRoute, setPubRoute] = useState<PublicationsRoute>('list');
  
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

  // Publish Modal State
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [pubDbName, setPubDbName] = useState('');
  const [pubName, setPubName] = useState('');
  const [pubPath, setPubPath] = useState('C:\\inetpub\\wwwroot\\');
  const [pubVer, setPubVer] = useState('');
  const [isEditingPub, setIsEditingPub] = useState(false);
  const [pubConfirmOpen, setPubConfirmOpen] = useState(false);
  const [pendingPublishPayload, setPendingPublishPayload] = useState<any | null>(null);

  // Confirm Actions
  const [unassignConfirm, setUnassignConfirm] = useState<{ clientId: string; dbName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);

  // Settings for publications
  const { settings, agentId } = useSettings();
  const versions = useMemo(() => {
    if (!settings?.installedVersionsJson) return [];
    try {
      const parsed = JSON.parse(settings.installedVersionsJson);
      return Array.isArray(parsed) ? parsed as string[] : [];
    } catch (e) {
      console.error('Ошибка парсинга installedVersionsJson:', e);
      return [];
    }
  }, [settings?.installedVersionsJson]);
  const publications = settings?.publications || [];

  useEffect(() => {
    if (settings?.defaultOneCVersion && !pubVer) {
      setPubVer(settings.defaultOneCVersion);
    }
  }, [settings, pubVer]);

  const sendCommand = async (type: string, payload: any) => {
    if (!agentId) return;
    try {
      const payloadJson = JSON.stringify(payload);
      console.log('Sending command:', type, 'payload JSON:', payloadJson);
      await apiFetchJson<{ commandId: string }>(`/api/agents/${agentId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payloadJson })
      });
      // We don't track the command ID here locally for the Publish modal, 
      // but the agent will pick it up. The user will see it in the queue if they switch tabs.
      // Or we could show a toast.
      toast.success({ title: 'Команда отправлена', message: 'Статус смотрите во вкладке “Публикации” → “Очередь агента”.' });
    } catch (e: any) {
      toast.error({ title: 'Ошибка', message: e?.message ? String(e.message) : 'Не удалось отправить команду агенту.' });
    }
  };

  const handlePublishClick = (dbName: string) => {
    setPubDbName(dbName);
    setPubName(dbName);
    setPubPath(`C:\\inetpub\\wwwroot\\${dbName}`);
    if (settings?.defaultOneCVersion) {
        setPubVer(settings.defaultOneCVersion);
    }
    setIsEditingPub(false);
    setIsPubModalOpen(true);
  };

  const handleEditPublication = (dbName: string, pub: AgentPublicationDto) => {
    setPubDbName(dbName);
    setPubName(pub.siteName);
    const derivedName = pub.appPath.startsWith('/') ? pub.appPath.substring(1) : pub.appPath;
    setPubName(derivedName || pub.siteName); 
    setPubPath(pub.physicalPath);
    setPubVer(pub.version || settings?.defaultOneCVersion || '');
    setIsEditingPub(true);
    setIsPubModalOpen(true);
  };

  const handlePublishSubmit = () => {
    if (!pubName || !pubPath || !pubVer) return;
    const appPath = pubName.startsWith('/') ? pubName : `/${pubName}`;

    // Ensure version is not truncated
    const version = String(pubVer).trim();
    console.log('Publish version:', version, 'length:', version.length);

    const payload = {
      SiteName: "Default Web Site",
      BaseName: pubName, 
      FolderPath: pubPath,
      ConnectionString: `Srvr="localhost";Ref="${pubDbName}";`,
      Version: version
    };

    console.log('Publish payload:', JSON.stringify(payload));
    setPendingPublishPayload(payload);
    setPubConfirmOpen(true);
  };

  const publicationsByBase = useMemo(() => {
    const map = new Map<string, AgentPublicationDto>();
    for (const p of publications) {
      const key = p.appPath.replace(/^\//, '').toLowerCase();
      if (!key) continue;
      map.set(key, p);
    }
    return map;
  }, [publications]);

  const pubNameError = useMemo(() => {
    const raw = (pubName || '').trim();
    if (!raw) return 'Укажите имя публикации.';
    if (/\s/.test(raw)) return 'Имя публикации не должно содержать пробелы.';
    if (raw.includes('\\')) return 'Имя публикации не должно содержать символ \\.';
    const s = raw.startsWith('/') ? raw.slice(1) : raw;
    if (!s) return 'Укажите имя публикации.';
    if (s.includes('/')) return 'Имя публикации должно быть одним сегментом (без / внутри).';
    if (!/^[a-zA-Z0-9._-]+$/.test(s)) return 'Допустимы: латиница, цифры, точка, дефис, подчёркивание.';
    return null;
  }, [pubName]);

  const pubPathError = useMemo(() => {
    const raw = (pubPath || '').trim();
    if (!raw) return 'Укажите путь к папке.';
    if (!/^[a-zA-Z]:\\/.test(raw)) return 'Путь должен начинаться с буквы диска (например C:\\).';
    if (raw.includes('/')) return 'Используйте обратные слеши (\\) для Windows-путей.';
    return null;
  }, [pubPath]);

  const currentPublication = useMemo(() => {
    const fromName = (pubName || '').trim();
    const base = (fromName.startsWith('/') ? fromName.slice(1) : fromName).toLowerCase();
    if (base) {
      const hit = publicationsByBase.get(base);
      if (hit) return hit;
    }
    const fallback = (pubDbName || '').trim().toLowerCase();
    return fallback ? (publicationsByBase.get(fallback) || null) : null;
  }, [pubDbName, pubName, publicationsByBase]);

  // Filtered and sorted clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clients.filter(c => {
      // Search filter
      const matchesSearch = !searchTerm || 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.databases.some(db => db.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      
      const matchesLimit = limitFilter === 'all' || 
        (limitFilter === 'limited' && c.maxSessions > 0) ||
        (limitFilter === 'unlimited' && c.maxSessions === 0);

      const isLimited = c.maxSessions > 0;
      const pct = isLimited ? (c.activeSessions / c.maxSessions) : 0;
      const hasRisk = isLimited && pct >= 0.8 && c.activeSessions < c.maxSessions;
      const isOver = isLimited && c.activeSessions >= c.maxSessions;
      const hasNoDbs = c.databases.length === 0;
      const hasAnyPub = c.databases.some(db => publicationsByBase.has(db.name.toLowerCase()));
      const hasNoPubs = c.databases.length > 0 && !hasAnyPub;

      const matchesOps =
        (!opsFilters.has('risk') || hasRisk) &&
        (!opsFilters.has('over') || isOver) &&
        (!opsFilters.has('noDbs') || hasNoDbs) &&
        (!opsFilters.has('noPubs') || hasNoPubs);
      
      return matchesSearch && matchesStatus && matchesLimit && matchesOps;
    });

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
  }, [clients, searchTerm, statusFilter, limitFilter, opsFilters, sortBy, sortOrder, publicationsByBase]);

  const toCsv = (rows: Array<Record<string, string>>) => {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0] || {});
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.map(esc).join(','),
      ...rows.map(r => headers.map(h => esc(r[h] ?? '')).join(','))
    ];
    return lines.join('\n');
  };

  const exportClientsCsv = () => {
    const rows = filteredAndSortedClients.map(c => {
      const max = c.maxSessions;
      const util = max > 0 ? Math.round((c.activeSessions / max) * 100) : '';
      const dbNames = c.databases.map(db => db.name);
      const publishedCount = dbNames.filter(n => publicationsByBase.has(n.toLowerCase())).length;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        activeSessions: String(c.activeSessions ?? 0),
        maxSessions: String(c.maxSessions ?? 0),
        utilizationPct: String(util),
        infobasesCount: String(c.databases.length),
        infobases: dbNames.join('; '),
        publishedInfobasesCount: String(publishedCount),
      };
    });
    const csv = toCsv(rows);
    downloadText(`clients_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`, csv, 'text/csv;charset=utf-8');
    toast.success({ title: 'Экспорт готов', message: `CSV: ${rows.length} клиентов` });
  };

  const exportClientsJson = () => {
    const json = JSON.stringify(filteredAndSortedClients, null, 2);
    downloadText(`clients_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`, json, 'application/json;charset=utf-8');
    toast.success({ title: 'Экспорт готов', message: `JSON: ${filteredAndSortedClients.length} клиентов` });
  };

  const toggleOpsFilter = (f: OpsFilter) => {
    setOpsFilters(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const handleHeaderSort = (field: 'name' | 'sessions' | 'databases' | 'status') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(field);
    if (field === 'name') setSortOrder('asc');
    else setSortOrder('desc');
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setIsModalOpen(true);
    setDetailsClientId(null);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
    setDetailsClientId(null);
  };

  const handleRemoveDatabase = (clientId: string, dbName: string) => {
    setUnassignConfirm({ clientId, dbName });
  };

  const confirmRemoveDatabase = () => {
    if (!unassignConfirm) return;
    const { clientId, dbName } = unassignConfirm;
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
    toast.info({ title: 'Инфобаза отвязана', message: `База «${dbName}» отвязана от клиента «${client.name}».` });
    setUnassignConfirm(null);
  };

  const handleQuickAssign = (dbName: string, clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    if (client.databases.some(db => db.name === dbName)) {
      toast.warning({ title: 'Уже привязано', message: 'База уже привязана к выбранному клиенту.' });
      return;
    }
    
    const assignedToOtherClient = clients.find(c => 
      c.id !== clientId && c.databases.some(db => db.name === dbName)
    );
    
    if (assignedToOtherClient) {
      toast.error({
        title: 'Конфликт привязки',
        message: `База «${dbName}» уже привязана к клиенту «${assignedToOtherClient.name}».\nКаждая база может быть привязана только к одному клиенту.`
      });
      return;
    }
    
    const updatedClient = {
      ...client,
      databases: [...client.databases, { name: dbName, activeSessions: 0 }]
    };
    
    onUpdate(updatedClient);
    toast.success({ title: 'Назначено', message: `База «${dbName}» назначена клиенту «${client.name}».` });
  };

  const handleDeleteClient = (id: string) => {
    const c = clients.find(x => x.id === id);
    setDeleteConfirm({ id, name: c?.name || id });
  };

  const handleOpenDetails = (client: Client) => {
    setView('clients');
    setDetailsClientId(prev => prev === client.id ? null : client.id);
  };

  const readStateFromHash = () => {
    const raw = (window.location.hash || '#/clients').replace(/^#\/?/, '');
    const [pathPart, qs] = raw.split('?');
    const segs = (pathPart || '').split('/').map(s => s.trim()).filter(Boolean);
    const base = segs[0] || 'clients';
    const sub = segs[1] || '';
    const sub2 = segs[2] || '';
    const params = new URLSearchParams(qs || '');

    const viewFromPath = (sub === 'infobases' || sub === 'publications') ? (sub as ClientsViewType) : null;
    const viewFromQuery = params.get('view') as ClientsViewType | null;
    const viewResolved =
      viewFromPath ||
      (viewFromQuery && ['clients', 'infobases', 'publications'].includes(viewFromQuery) ? viewFromQuery : null) ||
      'clients';

    return {
      base,
      view: viewResolved,
      pubRoute: sub === 'publications' && sub2 === 'mass-update' ? ('mass-update' as PublicationsRoute) : ('list' as PublicationsRoute),
      q: params.get('q') || '',
      status: (params.get('status') as StatusFilter | null) || 'all',
      limit: (params.get('limit') as LimitFilter | null) || 'all',
      sort: (params.get('sort') as any) || 'name',
      order: (params.get('order') as any) || 'asc',
      ops: (params.get('ops') || '').split(',').map(s => s.trim()).filter(Boolean) as OpsFilter[],
      clientId: params.get('clientId'),
      pubQ: params.get('pubQ') || '',
      pubVer: params.get('pubVer') || '',
      pubSite: params.get('pubSite') || '',
    };
  };

  const applyStateFromHash = () => {
    const st = readStateFromHash();
    if (st.base !== 'clients') return;

    if (st.clientId) {
      if (detailsClientId !== st.clientId) setDetailsClientId(st.clientId);
      if (view !== 'clients') setView('clients');
    } else {
      if (detailsClientId) setDetailsClientId(null);
      if (st.view && st.view !== view) setView(st.view);
    }

    if (st.q !== searchTerm) setSearchTerm(st.q);
    if (st.status && ['all', 'active', 'blocked', 'warning'].includes(st.status) && st.status !== statusFilter) {
      setStatusFilter(st.status);
    }
    if (st.limit && ['all', 'limited', 'unlimited'].includes(st.limit) && st.limit !== limitFilter) {
      setLimitFilter(st.limit);
    }
    if (st.sort && ['name', 'sessions', 'databases', 'status'].includes(st.sort) && st.sort !== sortBy) {
      setSortBy(st.sort);
    }
    if (st.order && ['asc', 'desc'].includes(st.order) && st.order !== sortOrder) {
      setSortOrder(st.order);
    }
    if (st.ops) {
      const allowed: OpsFilter[] = ['risk', 'over', 'noDbs', 'noPubs'];
      const next = new Set<OpsFilter>();
      for (const t of st.ops) if (allowed.includes(t)) next.add(t);
      const same =
        next.size === opsFilters.size &&
        Array.from(next).every(x => opsFilters.has(x));
      if (!same) setOpsFilters(next);
    }

    if (st.pubQ !== pubSearch) setPubSearch(st.pubQ);
    if (st.pubVer !== pubVersion) setPubVersion(st.pubVer);
    if (st.pubSite !== pubSite) setPubSite(st.pubSite);
    if (st.pubRoute !== pubRoute) setPubRoute(st.pubRoute);
  };

  useEffect(() => {
    applyStateFromHash();
    const onHash = () => applyStateFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('q', searchTerm.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (limitFilter !== 'all') params.set('limit', limitFilter);
    if (opsFilters.size > 0) params.set('ops', Array.from(opsFilters).join(','));
    if (detailsClientId) params.set('clientId', detailsClientId);
    if (sortBy !== 'name') params.set('sort', sortBy);
    if (sortOrder !== 'asc') params.set('order', sortOrder);

    const effectiveView: ClientsViewType = detailsClientId ? 'clients' : view;

    if (effectiveView === 'publications') {
      if (pubSearch.trim()) params.set('pubQ', pubSearch.trim());
      if (pubVersion) params.set('pubVer', pubVersion);
      if (pubSite) params.set('pubSite', pubSite);
    }

    const next = params.toString();
    const base = '#/clients';
    const pubSuffix = effectiveView === 'publications' && pubRoute === 'mass-update' ? '/mass-update' : '';
    const path = effectiveView !== 'clients' ? `${base}/${effectiveView}${pubSuffix}` : base;
    const nextHash = next ? `${path}?${next}` : path;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }, [view, searchTerm, statusFilter, limitFilter, opsFilters, detailsClientId, sortBy, sortOrder, pubSearch, pubVersion, pubSite, pubRoute]);

  const viewTab = (id: ClientsViewType) => {
    const active = view === id;
    const base = 'px-3 py-2 rounded-lg text-sm font-semibold transition-colors border';
    const activeCls = 'bg-indigo-500/15 text-indigo-100 border-indigo-500/30';
    const idleCls = 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10';
    return `${base} ${active ? activeCls : idleCls}`;
  };

  const pubsCount = publications.length;

  const applySavedView = (id: string) => {
    const v = savedViews.getById(id);
    if (!v) return;
    setSelectedSavedViewId(id);
    setDetailsClientId(null);
    setView(v.snapshot.view);
    setSearchTerm(v.snapshot.q || '');
    setStatusFilter(v.snapshot.status || 'all');
    setLimitFilter(v.snapshot.limit || 'all');
    setOpsFilters(new Set<OpsFilter>((v.snapshot.ops || []) as OpsFilter[]));
    setSortBy(v.snapshot.sortBy || 'name');
    setSortOrder(v.snapshot.sortOrder || 'asc');
    setPubSearch(v.snapshot.pubQ || '');
    setPubVersion(v.snapshot.pubVer || '');
    setPubSite(v.snapshot.pubSite || '');
    toast.success({ title: 'Представление применено', message: v.name });
  };

  const saveCurrentView = (name: string) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const v = savedViews.addView(trimmed, {
      view,
      q: searchTerm.trim(),
      status: statusFilter,
      limit: limitFilter,
      ops: Array.from(opsFilters),
      sortBy,
      sortOrder,
      pubQ: pubSearch.trim(),
      pubVer: pubVersion,
      pubSite: pubSite
    });
    setSelectedSavedViewId(v.id);
    toast.success({ title: 'Сохранено', message: `Представление: ${trimmed}` });
  };

  const deleteSelectedView = () => {
    if (!selectedSavedViewId) return;
    const v = savedViews.getById(selectedSavedViewId);
    savedViews.deleteView(selectedSavedViewId);
    setSelectedSavedViewId('');
    toast.info({ title: 'Удалено', message: v?.name ? `Представление: ${v.name}` : 'Представление удалено.' });
  };

  const handleSaveClient = (clientData: any) => {
    if (editingClient) {
      onUpdate({ ...editingClient, ...clientData });
    } else {
      onAdd(clientData);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <PageHeader 
        title="Клиенты и Лимиты"
        description="Зоны ответственности: Клиенты → Инфобазы → Публикации."
        actions={
          <div className="flex gap-2">
            {view === 'clients' ? (
              <>
                <ActionMenu
                  ariaLabel="Экспорт"
                  items={[
                    { id: 'exportCsv', label: 'Экспорт клиентов: CSV', onClick: exportClientsCsv },
                    { id: 'exportJson', label: 'Экспорт клиентов: JSON', onClick: exportClientsJson },
                  ]}
                />
                <Button onClick={handleOpenAdd} icon={<Plus size={18} />}>
                  Добавить клиента
                </Button>
              </>
            ) : null}

            {view === 'publications' ? (
              <Button
                variant="secondary"
                onClick={() => { setView('publications'); setPubRoute('mass-update'); }}
                title="Массовые операции над публикациями"
              >
                🔄 Массовая смена платформы
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={viewTab('clients')} onClick={() => { setView('clients'); setPubRoute('list'); }}>
            Клиенты <span className="text-xs text-slate-400 font-bold ml-1">{clients.length}</span>
          </button>
          <button type="button" className={viewTab('infobases')} onClick={() => { setView('infobases'); setPubRoute('list'); }}>
            Инфобазы <span className="text-xs text-slate-400 font-bold ml-1">{unassignedDatabases.length > 0 ? `+${unassignedDatabases.length}` : ''}</span>
          </button>
          <button type="button" className={viewTab('publications')} onClick={() => { setView('publications'); setPubRoute('list'); }}>
            Публикации <span className="text-xs text-slate-400 font-bold ml-1">{pubsCount > 0 ? pubsCount : ''}</span>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
          <div className="text-xs text-slate-400">
            {view === 'clients' ? 'Поиск/фильтры применяются к таблице клиентов.' : view === 'infobases' ? 'Назначение нераспределённых инфобаз клиентам.' : 'Управление Web‑публикациями и массовыми операциями.'}
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
            <span className="text-xs text-slate-500">Представление:</span>
            <select
              value={selectedSavedViewId}
              onChange={(e) => applySavedView(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none border-none py-0.5 min-w-[180px]"
              title="Сохранённые представления"
            >
              <option value="" className="bg-slate-900">Не выбрано</option>
              {savedViews.views.map(v => (
                <option key={v.id} value={v.id} className="bg-slate-900">
                  {v.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setSavedViewName(''); setSaveViewOpen(true); }}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
              title="Сохранить текущее представление"
            >
              <Save size={14} />
            </button>
            <button
              type="button"
              disabled={!selectedSavedViewId}
              onClick={() => setDeleteViewOpen(true)}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedSavedViewId ? 'Удалить выбранное представление' : 'Сначала выберите сохранённое представление'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Render View */}
      {view === 'clients' && (
        <ClientsView 
          clients={clients}
          filteredAndSortedClients={filteredAndSortedClients}
          unassignedCount={unassignedDatabases.length}
          
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          limitFilter={limitFilter}
          onLimitFilterChange={setLimitFilter}
          opsFilters={opsFilters}
          onToggleOpsFilter={toggleOpsFilter}
          
          lastUpdate={lastUpdate}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          
          onEdit={handleOpenEdit}
          onDelete={handleDeleteClient}
          onRemoveDatabase={handleRemoveDatabase}
          onPublish={handlePublishClick}
          onEditPublication={handleEditPublication}
          onOpenDetails={handleOpenDetails}
          
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleHeaderSort}
          
          publications={publications}
          expandedClientId={detailsClientId}
        />
      )}

      {view === 'infobases' && (
        <InfobasesView
          unassignedDatabases={unassignedDatabases}
          clients={clients}
          onAssign={handleQuickAssign}
          onRefresh={fetchDatabases}
          loading={loadingDbs}
        />
      )}

      {view === 'publications' && (
        <PublicationsView
          publications={publications}
          agentId={agentId}
          versions={versions}
          
          search={pubSearch}
          onSearchChange={setPubSearch}
          versionFilter={pubVersion}
          onVersionFilterChange={setPubVersion}
          siteFilter={pubSite}
          onSiteFilterChange={setPubSite}
          
          route={pubRoute}
          onRouteChange={setPubRoute}
          
          onEditPublication={handleEditPublication}
        />
      )}

      {/* Global Modals */}
      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingClient={editingClient}
        onSave={handleSaveClient}
        clients={clients}
      />

      <Modal
        isOpen={isPubModalOpen}
        onClose={() => setIsPubModalOpen(false)}
        title={isEditingPub ? `Настройки публикации: ${pubDbName}` : `Новая публикация: ${pubDbName}`}
      >
        <div className="space-y-4">
            {currentPublication ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <div className="font-semibold text-slate-50">Текущее состояние (обнаружено агентом)</div>
                <div className="mt-1 text-xs text-slate-400">
                  {currentPublication.lastDetectedAtUtc ? `Обновлено: ${formatRelativeShort(new Date(currentPublication.lastDetectedAtUtc))}` : ''}
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-400">IIS‑сайт: <span className="text-slate-100">{currentPublication.siteName}</span></div>
                  <div className="text-slate-400">URL: <span className="text-slate-100 font-mono">{currentPublication.appPath}</span></div>
                  <div className="text-slate-400 md:col-span-2">Путь: <span className="text-slate-100 font-mono">{currentPublication.physicalPath}</span></div>
                  <div className="text-slate-400">Версия: <span className="text-slate-100">{currentPublication.version || '—'}</span></div>
                </div>
                {!isEditingPub ? (
                  <div className="mt-2 text-xs text-amber-200">
                    Публикация уже существует — команда выполнит обновление настроек (а не создание новой).
                  </div>
                ) : null}
              </div>
            ) : null}

            <Input
              label="Имя публикации (URL path)"
              value={pubName}
              onChange={e => setPubName(e.target.value)}
              error={pubNameError || undefined}
              placeholder="Например: base01"
            />
            <Input
              label="Путь к папке (Physical Path)"
              value={pubPath}
              onChange={e => setPubPath(e.target.value)}
              placeholder="Например: C:\\inetpub\\wwwroot\\base01"
              error={pubPathError || undefined}
            />
            
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
                <Button onClick={handlePublishSubmit} disabled={!!pubNameError || !!pubPathError || !pubVer || !pubPath.trim()}>
                    {isEditingPub ? 'Сохранить изменения' : 'Опубликовать'}
                </Button>
            </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!unassignConfirm}
        onClose={() => setUnassignConfirm(null)}
        title={unassignConfirm ? `Отвязать базу «${unassignConfirm.dbName}»?` : 'Отвязать базу?'}
        description={
          unassignConfirm ? (
            <>
              <div>База будет отвязана от клиента. Это изменит распределение для лимитов и отчетности.</div>
              <div className="text-xs text-slate-400">Сама база в 1С не удаляется.</div>
            </>
          ) : null
        }
        confirmText="Отвязать"
        cancelText="Отмена"
        variant="danger"
        onConfirm={confirmRemoveDatabase}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={deleteConfirm ? `Удалить клиента «${deleteConfirm.name}»?` : 'Удалить клиента?'}
        description={
          deleteConfirm ? (
            <>
              <div>Клиент будет удален из списка. Действие необратимо.</div>
              <div className="text-xs text-slate-400">
                Рекомендуется сначала отвязать/перераспределить инфобазы, если это требуется вашей политикой.
              </div>
            </>
          ) : null
        }
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        onConfirm={() => {
          if (!deleteConfirm) return;
          onDelete(deleteConfirm.id);
          setDeleteConfirm(null);
        }}
      />

      <ConfirmDialog
        isOpen={pubConfirmOpen}
        onClose={() => setPubConfirmOpen(false)}
        title={isEditingPub ? 'Сохранить настройки публикации?' : 'Создать публикацию?'}
        description={
          pendingPublishPayload ? (
            <div className="space-y-1">
              <div>Инфобаза: <b className="text-slate-50">{pubDbName}</b></div>
              <div>URL path: <b className="text-slate-50">/{pendingPublishPayload.BaseName}</b></div>
              <div>Путь: <span className="font-mono text-slate-50">{pendingPublishPayload.FolderPath}</span></div>
              <div>Версия: <b className="text-slate-50">{pendingPublishPayload.Version}</b></div>
              <div className="text-xs text-slate-400">Команда будет отправлена агенту. Изменения появятся после обновления статуса.</div>
            </div>
          ) : null
        }
        confirmText={isEditingPub ? 'Сохранить' : 'Опубликовать'}
        cancelText="Отмена"
        variant="danger"
        onConfirm={() => {
          if (!pendingPublishPayload) return;
          sendCommand('Publish', pendingPublishPayload);
          setIsPubModalOpen(false);
          setPubConfirmOpen(false);
          setPendingPublishPayload(null);
        }}
      />

      {/* ClientDetailsDrawer removed - logic moved to expandable rows in ClientTable */}

      {/* Saved Views Modals */}
      <Modal
        isOpen={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title="Сохранить представление"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveViewOpen(false)}>Отмена</Button>
            <Button
              onClick={() => {
                const trimmed = savedViewName.trim();
                if (!trimmed) return;
                saveCurrentView(trimmed);
                setSaveViewOpen(false);
              }}
              disabled={!savedViewName.trim()}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            Сохранит вкладку + фильтры/сортировку (без открытия Drawer клиента).
          </div>
          <Input
            label="Название"
            value={savedViewName}
            onChange={(e) => setSavedViewName(e.target.value)}
            placeholder="Например: Перелимит + blocked"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        isOpen={deleteViewOpen}
        onClose={() => setDeleteViewOpen(false)}
        title="Удалить представление?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteViewOpen(false)}>Отмена</Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteSelectedView();
                setDeleteViewOpen(false);
              }}
              disabled={!selectedSavedViewId}
            >
              Удалить
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-slate-300">
          <div>Действие необратимо.</div>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;
