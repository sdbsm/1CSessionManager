import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Filter, Info, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { AlertLevel, Client, SystemEvent } from '../../types';
import { apiFetch, apiFetchJson } from '../../services/apiClient';
import { TimeRange, TimeRangePreset } from '../../hooks/useTimeRange';

interface EventsProps {
  timeRange: TimeRange;
  timePreset: TimeRangePreset;
  setTimePreset: (preset: TimeRangePreset) => void;
  clients: Client[];
}

type SortField = 'timestamp' | 'level';
type SortDirection = 'asc' | 'desc';

function parseHashQuery(): URLSearchParams {
  const raw = window.location.hash || '';
  const idx = raw.indexOf('?');
  if (idx < 0) return new URLSearchParams();
  return new URLSearchParams(raw.slice(idx + 1));
}

function setHashQuery(next: URLSearchParams) {
  const [path] = (window.location.hash || '#/events').split('?');
  const qs = next.toString();
  window.location.hash = qs ? `${path}?${qs}` : path;
}

function getLevelIcon(level: AlertLevel) {
  switch (level) {
    case 'critical': return <AlertCircle size={14} />;
    case 'warning': return <AlertTriangle size={14} />;
    default: return <Info size={14} />;
  }
}

function levelOrder(level: AlertLevel): number {
  return level === 'critical' ? 3 : level === 'warning' ? 2 : 1;
}

function eventDateUtc(e: SystemEvent): Date {
  if (e.timestampUtc) return new Date(e.timestampUtc);
  if (e.timestamp) return new Date(e.timestamp);
  if (e.timestampLocal) return new Date(e.timestampLocal);
  return new Date(0);
}

function SeverityBadge({ level }: { level: AlertLevel }) {
  const cls = level === 'critical'
    ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30'
    : level === 'warning'
      ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
      : 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30';
  const label = level === 'critical' ? 'CRITICAL' : level === 'warning' ? 'WARNING' : 'INFO';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {getLevelIcon(level)}
      {label}
    </span>
  );
}

const Events: React.FC<EventsProps> = ({ timeRange, timePreset, setTimePreset, clients }) => {
  const [events, setEvents] = useState<SystemEvent[]>([]);

  const [selectedLevels, setSelectedLevels] = useState<Set<AlertLevel>>(() => {
    const qp = parseHashQuery();
    const raw = qp.get('levels') || '';
    const tokens = raw.split(',').map(s => s.trim()).filter(Boolean);
    const set = new Set<AlertLevel>();
    for (const t of tokens) {
      if (t === 'info' || t === 'warning' || t === 'critical') set.add(t);
    }
    if (set.size === 0) return new Set(['critical', 'warning', 'info']);
    return set;
  });
  const [searchQuery, setSearchQuery] = useState(() => parseHashQuery().get('q') || '');
  const [clientId, setClientId] = useState(() => parseHashQuery().get('clientId') || '');
  const [databaseName, setDatabaseName] = useState(() => parseHashQuery().get('database') || '');
  const [userName, setUserName] = useState(() => parseHashQuery().get('user') || '');

  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date(0));
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  // Keep hash query in sync (shareable link)
  useEffect(() => {
    const qp = new URLSearchParams();
    const levels = Array.from(selectedLevels).sort((a, b) => levelOrder(b) - levelOrder(a));
    if (levels.length !== 3) qp.set('levels', levels.join(','));
    if (searchQuery.trim()) qp.set('q', searchQuery.trim());
    if (clientId) qp.set('clientId', clientId);
    if (databaseName.trim()) qp.set('database', databaseName.trim());
    if (userName.trim()) qp.set('user', userName.trim());
    setHashQuery(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevels, searchQuery, clientId, databaseName, userName]);

  const fetchEvents = async () => {
    setIsRefreshing(true);
    try {
      const qp = new URLSearchParams();
      qp.set('fromUtc', timeRange.fromUtc.toISOString());
      qp.set('toUtc', timeRange.toUtc.toISOString());
      qp.set('take', '500');

      const levels = Array.from(selectedLevels).sort((a, b) => levelOrder(b) - levelOrder(a));
      qp.set('levels', levels.join(','));
      if (searchQuery.trim()) qp.set('q', searchQuery.trim());
      if (clientId) qp.set('clientId', clientId);
      if (databaseName.trim()) qp.set('database', databaseName.trim());
      if (userName.trim()) qp.set('user', userName.trim());

      const data = await apiFetchJson<SystemEvent[]>(`/api/events?${qp.toString()}`);
      setEvents(data);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Failed to fetch events', e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange.fromUtc, timeRange.toUtc, searchQuery, clientId, databaseName, userName, selectedLevels]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const id = window.setInterval(() => { fetchEvents(); }, 10_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshEnabled, timeRange.fromUtc, timeRange.toUtc, searchQuery, clientId, databaseName, userName, selectedLevels]);

  const levelStats = useMemo(() => {
    const stats = { info: 0, warning: 0, critical: 0 };
    events.forEach(e => { stats[e.level]++; });
    return stats;
  }, [events]);

  const sortedEvents = useMemo(() => {
    const arr = [...events];
    arr.sort((a, b) => {
      if (sortField === 'timestamp') {
        const da = eventDateUtc(a).getTime();
        const db = eventDateUtc(b).getTime();
        return sortDirection === 'desc' ? db - da : da - db;
      }
      const oa = levelOrder(a.level);
      const ob = levelOrder(b.level);
      return sortDirection === 'desc' ? ob - oa : oa - ob;
    });
    return arr;
  }, [events, sortField, sortDirection]);

  const toggleLevel = (level: AlertLevel) => {
    const next = new Set(selectedLevels);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    setSelectedLevels(next.size ? next : new Set(['critical', 'warning', 'info']));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const clearFilters = () => {
    setSelectedLevels(new Set(['critical', 'warning', 'info']));
    setSearchQuery('');
    setClientId('');
    setDatabaseName('');
    setUserName('');
    setSelectedEvent(null);
  };

  const handleClearEvents = async () => {
    if (!window.confirm('Очистить все события? Это действие необратимо.')) return;
    setIsClearing(true);
    try {
      const res = await apiFetch('/api/events', { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      await fetchEvents();
    } catch (e) {
      console.error('Error clearing events:', e);
      alert('Ошибка при очистке событий');
    } finally {
      setIsClearing(false);
    }
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (searchQuery.trim()) chips.push({ key: 'q', label: `Поиск: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') });
    if (clientId) {
      const name = clients.find(c => c.id === clientId)?.name || clientId;
      chips.push({ key: 'client', label: `Клиент: ${name}`, onRemove: () => setClientId('') });
    }
    if (databaseName.trim()) chips.push({ key: 'db', label: `БД: ${databaseName.trim()}`, onRemove: () => setDatabaseName('') });
    if (userName.trim()) chips.push({ key: 'user', label: `Пользователь: ${userName.trim()}`, onRemove: () => setUserName('') });

    const levels = Array.from(selectedLevels);
    if (levels.length !== 3) chips.push({ key: 'levels', label: `Уровни: ${levels.join(', ')}`, onRemove: () => setSelectedLevels(new Set(['critical', 'warning', 'info'])) });
    return chips;
  }, [searchQuery, clientId, databaseName, userName, selectedLevels, clients]);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 5) return 'только что';
    if (diff < 60) return `${diff} сек назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return date.toLocaleString('ru-RU');
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">События</h1>
            <div className="text-sm text-slate-400">
              Журнал для расследования
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              {isRefreshing && <RefreshCw className="animate-spin" size={14} />}
              <span>{lastUpdate.getTime() > 0 ? `Обновлено ${formatRelativeTime(lastUpdate)}` : '—'}</span>
              <button
                onClick={() => setAutoRefreshEnabled(v => !v)}
                className="text-xs px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
              >
                {autoRefreshEnabled ? 'Live: on' : 'Live: off'}
              </button>
              <button
                onClick={fetchEvents}
                className="text-xs px-2 py-1 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-100"
              >
                Обновить
              </button>
            </div>

            <button
              onClick={handleClearEvents}
              disabled={isClearing}
              className="text-xs px-3 py-2 rounded-md bg-rose-600/90 hover:bg-rose-600 text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              title="Опасное действие: удалит все события из БД"
            >
              <Trash2 size={14} />
              Очистить
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        {/* Filter panel */}
        <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Filter size={16} className="text-slate-300" />
            <div className="font-semibold text-slate-50">Фильтры</div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-2">Время</div>
              <select
                value={timePreset}
                onChange={(e) => setTimePreset(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="1h" className="bg-slate-900">1 час</option>
                <option value="2h" className="bg-slate-900">2 часа</option>
                <option value="6h" className="bg-slate-900">6 часов</option>
                <option value="24h" className="bg-slate-900">1 день</option>
                <option value="7d" className="bg-slate-900">1 неделя</option>
                <option value="30d" className="bg-slate-900">1 месяц</option>
                <option value="365d" className="bg-slate-900">1 год</option>
              </select>
              <div className="mt-1 text-[10px] text-slate-500 text-center">
                {timeRange.fromUtc.toLocaleString('ru-RU')} — {timeRange.toUtc.toLocaleString('ru-RU')}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-2">Поиск</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="message / client / db / user / sessionId..."
                  className="w-full pl-9 pr-9 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    aria-label="Очистить поиск"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-2">Уровень (severity)</div>
              <div className="flex flex-wrap gap-2">
                {(['critical', 'warning', 'info'] as AlertLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-2 ${
                      selectedLevels.has(level)
                        ? level === 'critical'
                          ? 'bg-rose-500/15 text-rose-200 border-rose-500/30'
                          : level === 'warning'
                            ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                            : 'bg-sky-500/15 text-sky-200 border-sky-500/30'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {getLevelIcon(level)}
                    {level.toUpperCase()}
                    <span className="text-slate-400 font-medium">({levelStats[level]})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-2">Клиент</div>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="" className="bg-slate-900">Все</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-2">База данных</div>
                <input
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                  placeholder="точное имя"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-2">Пользователь</div>
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="точное имя"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={clearFilters}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
              >
                Сбросить
              </button>
              <div className="text-xs text-slate-500">
                {loading ? 'Загрузка…' : `${sortedEvents.length} событий`}
              </div>
            </div>
          </div>
        </div>

        {/* List + details */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {activeChips.length === 0 ? (
                  <span className="text-xs text-slate-500">Фильтры не заданы (используется только диапазон времени)</span>
                ) : (
                  activeChips.map(ch => (
                    <button
                      key={ch.key}
                      onClick={ch.onRemove}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center gap-2"
                      title="Убрать фильтр"
                    >
                      <span className="truncate max-w-[260px]">{ch.label}</span>
                      <X size={14} className="text-slate-400" />
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => handleSort('timestamp')}
                  className={`px-2 py-1 rounded-md border ${sortField === 'timestamp' ? 'bg-white/10 border-white/20 text-slate-100' : 'bg-transparent border-white/10 text-slate-300 hover:bg-white/5'}`}
                >
                  Время {sortField === 'timestamp' && (sortDirection === 'desc' ? <ChevronDown className="inline ml-1" size={14} /> : <ChevronUp className="inline ml-1" size={14} />)}
                </button>
                <button
                  onClick={() => handleSort('level')}
                  className={`px-2 py-1 rounded-md border ${sortField === 'level' ? 'bg-white/10 border-white/20 text-slate-100' : 'bg-transparent border-white/10 text-slate-300 hover:bg-white/5'}`}
                >
                  Severity {sortField === 'level' && (sortDirection === 'desc' ? <ChevronDown className="inline ml-1" size={14} /> : <ChevronUp className="inline ml-1" size={14} />)}
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-240px)]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950/80 backdrop-blur border-b border-white/10">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-400">Время</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-400">Severity</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-400">Сообщение</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-400">Контекст</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-sm text-slate-400">
                        События не найдены. Упростите фильтры или расширьте диапазон времени.
                      </td>
                    </tr>
                  ) : (
                    sortedEvents.map(ev => (
                      <tr
                        key={ev.id}
                        className={`cursor-pointer hover:bg-white/5 ${selectedEvent?.id === ev.id ? 'bg-white/5' : ''}`}
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <td className="px-5 py-3 text-xs font-mono text-slate-300 whitespace-nowrap">
                          {ev.timestampLocal || (ev.timestampUtc ? new Date(ev.timestampUtc).toLocaleString('ru-RU') : ev.timestamp || '—')}
                        </td>
                        <td className="px-5 py-3"><SeverityBadge level={ev.level} /></td>
                        <td className="px-5 py-3 text-sm text-slate-100">
                          <div className="truncate" title={ev.message}>{ev.message}</div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">
                          <div className="flex flex-col gap-0.5">
                            {ev.clientName && <div className="truncate" title={ev.clientName}>Client: {ev.clientName}</div>}
                            {ev.databaseName && <div className="truncate" title={ev.databaseName}>DB: {ev.databaseName}</div>}
                            {ev.userName && <div className="truncate" title={ev.userName}>User: {ev.userName}</div>}
                            {!ev.clientName && !ev.databaseName && !ev.userName && <div className="text-slate-500">—</div>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details drawer (fixed column on desktop) */}
          <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-semibold text-slate-50">Детали</div>
              {selectedEvent && (
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/5"
                  aria-label="Закрыть детали"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {!selectedEvent ? (
              <div className="p-5 text-sm text-slate-400">
                Выберите событие слева, чтобы увидеть контекст и быстрые действия.
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <SeverityBadge level={selectedEvent.level} />
                  <div className="text-xs font-mono text-slate-400">
                    {selectedEvent.timestampUtc || selectedEvent.timestampLocal || selectedEvent.timestamp || '—'}
                  </div>
                </div>

                <div className="text-sm text-slate-100 whitespace-pre-wrap">
                  {selectedEvent.message}
                </div>

                <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-slate-300 space-y-1">
                  <div><span className="text-slate-500">EventId:</span> {selectedEvent.id}</div>
                  {selectedEvent.clientName && <div><span className="text-slate-500">Client:</span> {selectedEvent.clientName}</div>}
                  {selectedEvent.databaseName && <div><span className="text-slate-500">DB:</span> {selectedEvent.databaseName}</div>}
                  {selectedEvent.userName && <div><span className="text-slate-500">User:</span> {selectedEvent.userName}</div>}
                  {selectedEvent.sessionId && <div><span className="text-slate-500">SessionId:</span> {selectedEvent.sessionId}</div>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedEvent.clientId && (
                    <button
                      onClick={() => setClientId(selectedEvent.clientId || '')}
                      className="text-xs px-3 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-100"
                    >
                      Фильтр: этот клиент
                    </button>
                  )}
                  {selectedEvent.databaseName && (
                    <button
                      onClick={() => setDatabaseName(selectedEvent.databaseName || '')}
                      className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
                    >
                      Фильтр: эта БД
                    </button>
                  )}
                  {selectedEvent.userName && (
                    <button
                      onClick={() => setUserName(selectedEvent.userName || '')}
                      className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
                    >
                      Фильтр: этот пользователь
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Events;
