import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Client, AgentPublicationDto } from '../../types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { ClientTable } from './ClientTable';
import { ClientModal } from './ClientModal';
import { ClientStats } from './ClientStats';
import { UnassignedDatabases } from './UnassignedDatabases';
import { ClientDetailsDrawer } from './ClientDetailsDrawer';
import { useInfobases } from '../../hooks/useInfobases';
import { useSettings } from '../../hooks/useSettings';
import { apiFetch, apiFetchJson } from '../../services/apiClient';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { downloadText } from '../../utils/download';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Badge } from '../../components/ui/Badge';
import { useSavedClientsViews } from '../../hooks/useSavedClientsViews';

interface ClientsProps {
  clients: Client[];
  onAdd: (client: Omit<Client, 'id'>) => void;
  onUpdate: (client: Client) => void;
  onDelete: (id: string) => void;
  lastUpdate?: Date;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

type StatusFilter = 'all' | 'active' | 'blocked' | 'warning';
type LimitFilter = 'all' | 'limited' | 'unlimited';
type OpsFilter = 'risk' | 'over' | 'noDbs' | 'noPubs';
type ClientsView = 'clients' | 'infobases' | 'publications';
type AgentCommandStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed' | string;
type PublicationsRoute = 'list' | 'mass-update';
type AgentCommandDto = {
  id: string;
  commandType: string;
  status: AgentCommandStatus;
  errorMessage?: string | null;
  progressPercent?: number | null;
  progressMessage?: string | null;
  startedAtUtc?: string | null;
  lastUpdatedAtUtc?: string | null;
  createdAtUtc: string;
  processedAtUtc?: string | null;
};

const Clients: React.FC<ClientsProps> = ({ clients, onAdd, onUpdate, onDelete, lastUpdate, isRefreshing, onRefresh }) => {
  const toast = useToast();
  const savedViews = useSavedClientsViews();
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [deleteViewOpen, setDeleteViewOpen] = useState(false);
  const [savedViewName, setSavedViewName] = useState('');
  const [view, setView] = useState<ClientsView>('clients');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [limitFilter, setLimitFilter] = useState<LimitFilter>('all');
  const [opsFilters, setOpsFilters] = useState<Set<OpsFilter>>(() => new Set());
  const [sortBy, setSortBy] = useState<'name' | 'sessions' | 'databases' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Publications filters (Publications tab)
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

  // Mass Update State
  const [massSource, setMassSource] = useState('');
  const [massTarget, setMassTarget] = useState('');
  const [massConfirmOpen, setMassConfirmOpen] = useState(false);
  
  // Publish Modal State
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [pubDbName, setPubDbName] = useState('');
  const [pubName, setPubName] = useState('');
  const [pubPath, setPubPath] = useState('C:\\inetpub\\wwwroot\\');
  const [pubVer, setPubVer] = useState('');
  // New state to track if we are editing an existing publication
  const [isEditingPub, setIsEditingPub] = useState(false);
  const [pubConfirmOpen, setPubConfirmOpen] = useState(false);
  const [pendingPublishPayload, setPendingPublishPayload] = useState<any | null>(null);

  // Confirm unassign database
  const [unassignConfirm, setUnassignConfirm] = useState<{ clientId: string; dbName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);

  // Settings for publications
  const { settings, agentId } = useSettings();
  const versions = settings?.installedVersionsJson ? JSON.parse(settings.installedVersionsJson) as string[] : [];
  const publications = settings?.publications || [];

  // Agent commands (status/progress)
  const [agentCommands, setAgentCommands] = useState<AgentCommandDto[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [commandsLastUpdate, setCommandsLastUpdate] = useState<Date>(new Date(0));

  useEffect(() => {
    if (settings?.defaultOneCVersion && !pubVer) {
      setMassTarget(settings.defaultOneCVersion);
      setPubVer(settings.defaultOneCVersion);
    }
  }, [settings, pubVer]);

  const fetchAgentCommands = async () => {
    if (!agentId) return;
    setCommandsLoading(true);
    try {
      const rows = await apiFetchJson<AgentCommandDto[]>(`/api/agents/${agentId}/commands?take=30`);
      setAgentCommands(rows || []);
      setCommandsLastUpdate(new Date());
    } catch (e) {
      console.warn('Failed to load agent commands', e);
    } finally {
      setCommandsLoading(false);
    }
  };

  const hasInFlightCommands = useMemo(() => {
    return agentCommands.some(c => c.status === 'Pending' || c.status === 'Processing');
  }, [agentCommands]);

  useEffect(() => {
    if (view !== 'publications') return;
    if (!agentId) return;
    fetchAgentCommands();
    const id = window.setInterval(() => fetchAgentCommands(), hasInFlightCommands ? 5_000 : 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, agentId, hasInFlightCommands]);

  const sendCommand = async (type: string, payload: any) => {
    if (!agentId) return;
    try {
      const res = await apiFetchJson<{ commandId: string }>(`/api/agents/${agentId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payloadJson: JSON.stringify(payload) })
      });
      const commandId = res?.commandId;
      if (commandId) {
        const optimistic: AgentCommandDto = {
          id: commandId,
          commandType: type,
          status: 'Pending',
          errorMessage: null,
          progressPercent: 0,
          progressMessage: 'Ожидание агента...',
          startedAtUtc: null,
          lastUpdatedAtUtc: new Date().toISOString(),
          createdAtUtc: new Date().toISOString(),
          processedAtUtc: null
        };
        setAgentCommands(prev => [optimistic, ...prev].slice(0, 30));
        setCommandsLastUpdate(new Date());
      }
      toast.success({ title: 'Команда отправлена', message: 'Статус смотрите во вкладке “Публикации” → “Очередь агента”.' });
    } catch (e: any) {
      toast.error({ title: 'Ошибка', message: e?.message ? String(e.message) : 'Не удалось отправить команду агенту.' });
    }
  };

  const handleMassUpdate = () => {
    if (!massTarget) return; // Only target is required now
    setPendingPublishPayload(null);
    setMassConfirmOpen(true);
  };

  const executeMassUpdate = () => {
    if (!massTarget) return;
    sendCommand('MassUpdateVersions', {
      SourceVersion: massSource,
      TargetVersion: massTarget
    });
    setPubRoute('list');
    setMassConfirmOpen(false);
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

    const payload = {
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
    };

    setPendingPublishPayload(payload);
    setPubConfirmOpen(true);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 5) return 'только что';
    if (diff < 60) return `${diff}с назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
    return date.toLocaleTimeString('ru-RU');
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    if (totalSec < 60) return `${totalSec}с`;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m < 60) return `${m}м ${s}с`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}ч ${mm}м`;
  };

  const etaFor = (c: AgentCommandDto) => {
    if (c.status !== 'Processing') return null;
    const p = typeof c.progressPercent === 'number' ? c.progressPercent : null;
    if (p == null || p <= 0 || p >= 100) return null;
    if (!c.startedAtUtc) return null;
    const started = new Date(c.startedAtUtc);
    if (Number.isNaN(started.getTime())) return null;
    const elapsed = Date.now() - started.getTime();
    if (elapsed <= 0) return null;
    const remaining = Math.floor(elapsed * (100 - p) / p);
    if (remaining <= 0) return null;
    return `≈ ${formatDuration(remaining)}`;
  };

  const commandBadge = (status: AgentCommandStatus) => {
    const st = (status || '').toString();
    if (st === 'Completed') return <Badge variant="success" size="sm">Готово</Badge>;
    if (st === 'Failed') return <Badge variant="danger" size="sm">Ошибка</Badge>;
    if (st === 'Processing') return <Badge variant="warning" size="sm">В работе</Badge>;
    if (st === 'Pending') return <Badge variant="neutral" size="sm">В очереди</Badge>;
    return <Badge variant="neutral" size="sm">{st || '—'}</Badge>;
  };

  const cmdCounts = useMemo(() => {
    let pending = 0, processing = 0, failed = 0;
    for (const c of agentCommands) {
      if (c.status === 'Pending') pending++;
      else if (c.status === 'Processing') processing++;
      else if (c.status === 'Failed') failed++;
    }
    return { pending, processing, failed };
  }, [agentCommands]);

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
    // Basic safety: we expect URL path segment (no spaces, no backslashes)
    if (/\s/.test(raw)) return 'Имя публикации не должно содержать пробелы.';
    if (raw.includes('\\')) return 'Имя публикации не должно содержать символ \\.';
    const s = raw.startsWith('/') ? raw.slice(1) : raw;
    if (!s) return 'Укажите имя публикации.';
    if (s.includes('/')) return 'Имя публикации должно быть одним сегментом (без / внутри).';
    if (!/^[a-zA-Z0-9._-]+$/.test(s)) return 'Допустимы: латиница, цифры, точка, дефис, подчёркивание.';
    return null;
  }, [pubName]);

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
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      
      // Limit filter
      const matchesLimit = limitFilter === 'all' || 
        (limitFilter === 'limited' && c.maxSessions > 0) ||
        (limitFilter === 'unlimited' && c.maxSessions === 0);

      // Ops filters
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
  }, [clients, searchTerm, statusFilter, limitFilter, opsFilters, sortBy, sortOrder, publicationsByBase]);

  const toCsv = (rows: Array<Record<string, string>>) => {
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
    // sensible defaults per column type
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
    setDetailsClientId(client.id);
  };

  const readStateFromHash = () => {
    const raw = (window.location.hash || '#/clients').replace(/^#\/?/, '');
    const [pathPart, qs] = raw.split('?');
    const segs = (pathPart || '').split('/').map(s => s.trim()).filter(Boolean);
    const base = segs[0] || 'clients';
    const sub = segs[1] || '';
    const sub2 = segs[2] || '';
    const params = new URLSearchParams(qs || '');

    const viewFromPath = (sub === 'infobases' || sub === 'publications') ? (sub as ClientsView) : null;
    const viewFromQuery = params.get('view') as ClientsView | null;
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

    // deep-link to drawer should always land on Clients view
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

  // Initial restore + keep in sync with browser Back/Forward
  useEffect(() => {
    applyStateFromHash();
    const onHash = () => applyStateFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('q', searchTerm.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (limitFilter !== 'all') params.set('limit', limitFilter);
    if (opsFilters.size > 0) params.set('ops', Array.from(opsFilters).join(','));
    if (detailsClientId) params.set('clientId', detailsClientId);
    if (sortBy !== 'name') params.set('sort', sortBy);
    if (sortOrder !== 'asc') params.set('order', sortOrder);

    const effectiveView: ClientsView = detailsClientId ? 'clients' : view;

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

  const affectedPublicationsCount = useMemo(() => {
    if (!massTarget) return 0;
    // If source is empty => all
    return publications.filter(p => {
      if (!massSource) return true;
      return (p.version || '') === massSource;
    }).length;
  }, [publications, massSource, massTarget]);

  const pubSites = useMemo(() => {
    const s = new Set<string>();
    for (const p of publications) {
      const site = (p.siteName || '').trim();
      if (site) s.add(site);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [publications]);

  const filteredPublications = useMemo(() => {
    const q = pubSearch.trim().toLowerCase();
    const ver = (pubVersion || '').trim();
    const site = (pubSite || '').trim();
    return publications.filter(p => {
      if (ver && (p.version || '') !== ver) return false;
      if (site && (p.siteName || '') !== site) return false;
      if (!q) return true;
      const hay = `${p.siteName || ''} ${p.appPath || ''} ${p.physicalPath || ''} ${p.version || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [publications, pubSearch, pubVersion, pubSite]);

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

  const viewTab = (id: ClientsView) => {
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

      {view === 'clients' ? (
        <ClientStats clients={clients} unassignedCount={unassignedDatabases.length} />
      ) : null}

      {view === 'infobases' ? (
        <>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
            Здесь — операционные задачи по инфобазам: найти нераспределённые и быстро назначить клиентам.
          </div>
          <UnassignedDatabases 
            unassignedDatabases={unassignedDatabases}
            clients={clients}
            onAssign={handleQuickAssign}
            onRefresh={fetchDatabases}
            loading={loadingDbs}
          />
        </>
      ) : null}

      {view === 'publications' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-50">Очередь агента (команды)</div>
                <div className="text-xs text-slate-400 mt-1">В очереди → В работе → Готово / Ошибка</div>
              </div>
              <div className="flex items-center gap-2">
                {cmdCounts.failed > 0 ? <Badge variant="danger" size="sm">Ошибок: {cmdCounts.failed}</Badge> : null}
                {cmdCounts.processing > 0 ? <Badge variant="warning" size="sm">В работе: {cmdCounts.processing}</Badge> : null}
                {cmdCounts.pending > 0 ? <Badge variant="neutral" size="sm">В очереди: {cmdCounts.pending}</Badge> : null}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={fetchAgentCommands}
                  isLoading={commandsLoading}
                  icon={<RefreshCw size={14} className={hasInFlightCommands ? 'animate-spin' : ''} />}
                >
                  Обновить
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 w-[130px]">Статус</th>
                    <th className="px-4 py-3">Команда</th>
                    <th className="px-4 py-3 w-[160px]">Создана</th>
                    <th className="px-4 py-3 w-[160px]">Завершена</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {agentCommands.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                        Команд пока нет. Запустите публикацию/массовую операцию — она появится здесь.
                      </td>
                    </tr>
                  ) : (
                    agentCommands.slice(0, 30).map(c => {
                      const created = c.createdAtUtc ? new Date(c.createdAtUtc) : null;
                      const done = c.processedAtUtc ? new Date(c.processedAtUtc) : null;
                      const eta = etaFor(c);
                      const p = typeof c.progressPercent === 'number' ? Math.max(0, Math.min(100, c.progressPercent)) : null;
                      return (
                        <tr key={c.id} className={c.status === 'Failed' ? 'bg-rose-500/5' : 'hover:bg-white/5 transition-colors'}>
                          <td className="px-4 py-2">{commandBadge(c.status)}</td>
                          <td className="px-4 py-2">
                            <div className="text-slate-100 font-semibold">{c.commandType}</div>
                            {p != null ? (
                              <div className="mt-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>{p}%</span>
                                  <span className="truncate max-w-[520px]">{c.progressMessage || ''}</span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500/70"
                                    style={{ width: `${p}%` }}
                                  />
                                </div>
                              </div>
                            ) : (c.progressMessage ? (
                              <div className="text-xs text-slate-400 mt-0.5">{c.progressMessage}</div>
                            ) : null)}
                            {c.errorMessage ? <div className="text-xs text-rose-200 mt-0.5 break-all">{c.errorMessage}</div> : null}
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" title={c.id}>{c.id}</div>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-400 font-mono whitespace-nowrap">{created ? formatRelativeTime(created) : '—'}</td>
                          <td className="px-4 py-2 text-xs text-slate-400 font-mono whitespace-nowrap">
                            {done ? formatRelativeTime(done) : (eta ? `ETA ${eta}` : '—')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/10 text-xs text-slate-500 flex items-center justify-between">
              <span>Автообновление: {hasInFlightCommands ? 'каждые 5с' : 'каждые 15с'}</span>
              <span>{commandsLastUpdate.getTime() > 0 ? `Обновлено: ${formatRelativeTime(commandsLastUpdate)}` : ''}</span>
            </div>
          </div>

          {pubRoute === 'mass-update' ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-50">Массовая смена платформы (публикации)</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Это отдельный экран (deep‑link). Статус и прогресс операции отслеживайте в “Очереди агента” выше.
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setPubRoute('list')} title="Вернуться к списку публикаций">
                  Назад к публикациям
                </Button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-300">Исходная версия (откуда)</label>
                  <Select
                    value={massSource}
                    onChange={e => setMassSource(e.target.value)}
                    options={[{ value: '', label: 'Все (любая версия)' }, ...versions.map(v => ({ value: v, label: v }))]}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-300">Целевая версия (куда)</label>
                  <Select
                    value={massTarget}
                    onChange={e => setMassTarget(e.target.value)}
                    options={[{ value: '', label: '--' }, ...versions.map(v => ({ value: v, label: v }))]}
                  />
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                  <div className="font-semibold text-slate-50">Предпросмотр</div>
                  <div className="mt-1 text-slate-300">
                    Будет затронуто публикаций: <b className="text-slate-50">{affectedPublicationsCount}</b>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Фильтр “исходная версия” ограничивает список, иначе меняются все публикации.
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setPubRoute('list')}>Отмена</Button>
                  <Button onClick={handleMassUpdate} disabled={!massTarget}>Запустить</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="text-sm font-semibold text-slate-50">Web‑публикации (обнаружено агентом)</div>
                <div className="text-xs text-slate-400 mt-1">
                  Для редактирования откройте “Публикация” или используйте массовую смену платформы. Фильтры применяются только к этой таблице.
                </div>
              </div>
              <div className="p-4 border-b border-white/10 bg-slate-950/40">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      value={pubSearch}
                      onChange={(e) => setPubSearch(e.target.value)}
                      placeholder="Поиск по URL/пути/версии..."
                      className="!bg-white/5 !border-white/10 !text-slate-100"
                      fullWidth
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select
                      fullWidth={false}
                      value={pubVersion}
                      onChange={(e) => setPubVersion(e.target.value)}
                      options={[
                        { value: '', label: 'Любая версия' },
                        ...versions.map(v => ({ value: v, label: v }))
                      ]}
                    />
                    <Select
                      fullWidth={false}
                      value={pubSite}
                      onChange={(e) => setPubSite(e.target.value)}
                      options={[
                        { value: '', label: 'Любой IIS‑сайт' },
                        ...pubSites.map(s => ({ value: s, label: s }))
                      ]}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setPubSearch('');
                        setPubVersion('');
                        setPubSite('');
                      }}
                      disabled={!pubSearch && !pubVersion && !pubSite}
                      title="Сбросить фильтры публикаций"
                    >
                      Сбросить
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Найдено публикаций: <b className="text-slate-200">{filteredPublications.length}</b>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Сайт</th>
                      <th className="px-4 py-3">URL</th>
                      <th className="px-4 py-3">Путь</th>
                      <th className="px-4 py-3">Версия</th>
                      <th className="px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredPublications.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                          Ничего не найдено. Сбросьте фильтры или проверьте агента/настройки.
                        </td>
                      </tr>
                    ) : (
                      filteredPublications.map(p => {
                        const base = p.appPath.replace(/^\//, '') || p.siteName || p.id;
                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-slate-300 text-xs">{p.siteName || '—'}</td>
                            <td className="px-4 py-3 text-slate-100 font-mono text-xs">{p.appPath || '—'}</td>
                            <td className="px-4 py-3 text-slate-300 font-mono text-xs truncate max-w-[520px]" title={p.physicalPath}>{p.physicalPath || '—'}</td>
                            <td className="px-4 py-3 text-slate-200">{p.version || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <ActionMenu
                                ariaLabel="Действия с публикацией"
                                items={[{ id: `edit:${p.id}`, label: 'Настройки', onClick: () => handleEditPublication(base, p) }]}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {view === 'clients' ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-slate-950/40">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                    onClick={() => setStatusFilter(f.id as any)}
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
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                {[
                  { id: 'risk', label: 'В риске ≥80%', activeClass: 'bg-amber-600 text-white', title: 'Клиенты с лимитом: загрузка 80–99%' },
                  { id: 'over', label: 'Перелимит', activeClass: 'bg-rose-600 text-white', title: 'Клиенты с лимитом: факт ≥ план' },
                  { id: 'noDbs', label: 'Без инфобаз', activeClass: 'bg-slate-700 text-white', title: 'Клиенты без привязанных инфобаз' },
                  { id: 'noPubs', label: 'Без публикаций', activeClass: 'bg-indigo-600 text-white', title: 'Есть инфобазы, но нет Web‑публикаций' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleOpsFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      opsFilters.has(f.id as any)
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
                <span>{lastUpdate && lastUpdate.getTime() > 0 ? `Обновлено: ${formatRelativeTime(lastUpdate)}` : ''}</span>
              </div>
            </div>
          </div>
          
          <ClientTable 
            clients={filteredAndSortedClients}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteClient}
            onRemoveDatabase={handleRemoveDatabase}
            publications={publications}
            onPublish={handlePublishClick}
            onEditPublication={handleEditPublication}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleHeaderSort}
            onOpenDetails={handleOpenDetails}
          />
        </div>
      ) : null}

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingClient={editingClient}
        onSave={handleSaveClient}
        clients={clients}
      />

      {/* Publish Modal */}
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
                  {currentPublication.lastDetectedAtUtc ? `Обновлено: ${formatRelativeTime(new Date(currentPublication.lastDetectedAtUtc))}` : ''}
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
                <Button onClick={handlePublishSubmit} disabled={!!pubNameError || !pubVer || !pubPath.trim()}>
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
        isOpen={massConfirmOpen}
        onClose={() => setMassConfirmOpen(false)}
        title="Запустить массовую смену платформы?"
        description={
          <>
            <div>Исходная версия: <b className="text-slate-50">{massSource || 'Любая'}</b></div>
            <div>Целевая версия: <b className="text-slate-50">{massTarget || '--'}</b></div>
            <div>Публикаций к изменению: <b className="text-slate-50">{affectedPublicationsCount}</b></div>
            <div className="text-xs text-slate-400">Операция выполняется агентом и может занять время.</div>
          </>
        }
        confirmText="Запустить"
        cancelText="Отмена"
        variant="danger"
        onConfirm={executeMassUpdate}
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

      <ClientDetailsDrawer
        isOpen={!!detailsClientId}
        onClose={() => setDetailsClientId(null)}
        client={detailsClientId ? (clients.find(c => c.id === detailsClientId) || null) : null}
        publications={publications}
        onOpenEvents={(clientId) => {
          const ret = window.location.hash || '#/clients';
          window.location.hash = `#/events?clientId=${encodeURIComponent(clientId)}&return=${encodeURIComponent(ret)}`;
          setDetailsClientId(null);
        }}
        onEditClient={(c) => {
          setDetailsClientId(null);
          handleOpenEdit(c);
        }}
        onRemoveDatabase={(clientId, dbName) => handleRemoveDatabase(clientId, dbName)}
        onPublish={(dbName) => handlePublishClick(dbName)}
        onEditPublication={(dbName, pub) => handleEditPublication(dbName, pub)}
      />

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
