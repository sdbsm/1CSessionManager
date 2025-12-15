import React, { useMemo, useState } from 'react';
import { Client, SystemEvent, AlertLevel } from '../../types';
import { TimeRange, TimeRangePreset } from '../../hooks/useTimeRange';
import { useEvents } from '../../hooks/useEvents';
import EventFilters from './components/EventFilters';
import EventTable from './components/EventTable';
import EventDetails from './components/EventDetails';
import { Drawer } from '../../components/ui/Drawer';
import { downloadText } from '../../utils/download';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { EventGroups, GroupBy } from './components/EventGroups';
import { useSavedEventViews } from '../../hooks/useSavedEventViews';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { eventDateUtc as eventDateUtcSafe } from '../../utils/time';

interface EventsProps {
  timeRange: TimeRange;
  timePreset: TimeRangePreset;
  setTimePreset: (preset: TimeRangePreset) => void;
  clients: Client[];
}

const Events: React.FC<EventsProps> = ({ timeRange, timePreset, setTimePreset, clients }) => {
  const toast = useToast();
  const {
    events,
    loading,
    isRefreshing,
    lastUpdate,
    refresh,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    filters,
    setFilterValue,
    setFiltersAll,
    toggleLevel,
    clearFilters,
    applyPreset,
    levelStats,
    sortField,
    sortDirection,
    toggleSort,
    handleClearEvents
  } = useEvents(timeRange);

  const { views: savedViews, addView, deleteView, getById } = useSavedEventViews();
  const [selectedSavedViewId, setSelectedSavedViewId] = useState<string>(() => {
    const raw = window.location.hash || '';
    const idx = raw.indexOf('?');
    if (idx < 0) return '';
    const params = new URLSearchParams(raw.slice(idx + 1));
    return params.get('sv') || '';
  });

  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);
  const [lastSeenUtc, setLastSeenUtc] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ui.events.lastSeenUtc');
    } catch {
      return null;
    }
  });
  const [viewMode, setViewMode] = useState<'list' | 'groups'>(() => {
    const raw = window.location.hash || '';
    const idx = raw.indexOf('?');
    if (idx < 0) return 'list';
    const params = new URLSearchParams(raw.slice(idx + 1));
    return params.get('view') === 'groups' ? 'groups' : 'list';
  });
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    const raw = window.location.hash || '';
    const idx = raw.indexOf('?');
    if (idx < 0) return 'client';
    const params = new URLSearchParams(raw.slice(idx + 1));
    const g = params.get('groupBy');
    if (g === 'infobase' || g === 'time') return g;
    return 'client';
  });
  const [timeBucket, setTimeBucket] = useState<{ from: Date; to: Date } | null>(() => {
    const raw = window.location.hash || '';
    const idx = raw.indexOf('?');
    if (idx < 0) return null;
    const params = new URLSearchParams(raw.slice(idx + 1));
    const bf = params.get('bucketFrom');
    const bt = params.get('bucketTo');
    if (!bf || !bt) return null;
    const from = new Date(bf);
    const to = new Date(bt);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to.getTime() <= from.getTime()) return null;
    return { from, to };
  });

  const handleCloseModal = () => setSelectedEvent(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const applySavedView = (id: string) => {
    const v = getById(id);
    if (!v) return;

    const levels = new Set<AlertLevel>(v.snapshot.filters.levels || []);
    setFiltersAll({
      levels: levels.size ? levels : new Set([AlertLevel.CRITICAL, AlertLevel.WARNING, AlertLevel.INFO]),
      search: v.snapshot.filters.search || '',
      clientId: v.snapshot.filters.clientId || '',
      database: v.snapshot.filters.database || '',
      user: v.snapshot.filters.user || ''
    });
    setViewMode(v.snapshot.viewMode || 'list');
    setGroupBy(v.snapshot.groupBy || 'client');
    setTimeBucket(null);
    setSelectedSavedViewId(id);

    // Persist selection in URL for shareability
    const raw = window.location.hash || '#/events';
    const [path, qs] = raw.split('?');
    const params = new URLSearchParams(qs || '');
    params.set('sv', id);
    const next = params.toString();
    const nextHash = next ? `${path}?${next}` : path;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;

    toast.success({ title: 'Представление применено', message: v.name });
  };

  const saveCurrentView = (name: string) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const snapshot = {
      filters: {
        levels: Array.from(filters.levels),
        search: filters.search,
        clientId: filters.clientId,
        database: filters.database,
        user: filters.user
      },
      viewMode,
      groupBy
    } as const;
    const v = addView(trimmed, snapshot);
    setSelectedSavedViewId(v.id);
    toast.success({ title: 'Сохранено', message: `Представление: ${trimmed}` });
  };

  const deleteSavedView = (id: string) => {
    const v = getById(id);
    deleteView(id);
    if (selectedSavedViewId === id) setSelectedSavedViewId('');
    toast.info({ title: 'Удалено', message: v?.name ? `Представление: ${v.name}` : 'Представление удалено.' });

    // Remove from URL if it was selected
    const raw = window.location.hash || '#/events';
    const [path, qs] = raw.split('?');
    const params = new URLSearchParams(qs || '');
    if (params.get('sv') === id) params.delete('sv');
    const next = params.toString();
    const nextHash = next ? `${path}?${next}` : path;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  };

  const returnHash = useMemo(() => {
    const raw = window.location.hash || '';
    const idx = raw.indexOf('?');
    if (idx < 0) return null;
    const params = new URLSearchParams(raw.slice(idx + 1));
    const ret = params.get('return');
    if (!ret) return null;
    try {
      return decodeURIComponent(ret);
    } catch {
      return ret;
    }
  }, []);

  const toCsv = (rows: Array<Record<string, string>>) => {
    const headers = Object.keys(rows[0] || {});
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.map(esc).join(','),
      ...rows.map(r => headers.map(h => esc(r[h] ?? '')).join(','))
    ];
    return lines.join('\n');
  };

  const visibleEvents = useMemo(() => {
    if (!timeBucket) return events;
    const fromMs = timeBucket.from.getTime();
    const toMs = timeBucket.to.getTime();
    return events.filter(e => {
      const d = eventDateUtcSafe(e);
      if (!d) return false;
      const t = d.getTime();
      return t >= fromMs && t < toMs;
    });
  }, [events, timeBucket]);

  const exportCsv = () => {
    const rows = visibleEvents.map(e => ({
      id: e.id,
      level: e.level,
      timestampUtc: e.timestampUtc || '',
      timestampLocal: e.timestampLocal || e.timestamp || '',
      client: e.clientName || '',
      infobase: e.databaseName || '',
      user: e.userName || '',
      sessionId: e.sessionId || '',
      message: e.message || ''
    }));
    const csv = toCsv(rows);
    downloadText(`events_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const exportJson = () => {
    const json = JSON.stringify(visibleEvents, null, 2);
    downloadText(`events_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`, json, 'application/json;charset=utf-8');
  };

  const markRead = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem('ui.events.lastSeenUtc', now);
    } catch { /* ignore */ }
    setLastSeenUtc(now);
    toast.success({ title: 'Готово', message: 'События отмечены как прочитанные.' });
  };

  // Persist view/groupBy + bucket in URL (filters are managed by useEvents and preserve these keys)
  React.useEffect(() => {
    const raw = window.location.hash || '#/events';
    const [path, qs] = raw.split('?');
    const params = new URLSearchParams(qs || '');
    if (viewMode === 'groups') params.set('view', 'groups');
    else params.delete('view');
    if (viewMode === 'groups') params.set('groupBy', groupBy);
    else params.delete('groupBy');
    if (timeBucket) {
      params.set('bucketFrom', timeBucket.from.toISOString());
      params.set('bucketTo', timeBucket.to.toISOString());
    } else {
      params.delete('bucketFrom');
      params.delete('bucketTo');
    }
    const next = params.toString();
    const nextHash = next ? `${path}?${next}` : path;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }, [viewMode, groupBy, timeBucket]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in duration-300">
      
      {/* Header Area */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          {returnHash && (
            <button
              type="button"
              onClick={() => { window.location.hash = returnHash; }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors text-sm"
              title="Вернуться назад"
            >
              <ArrowLeft size={16} />
              Назад
            </button>
          )}
          <h1 className="text-2xl font-semibold text-slate-50">События</h1>
        </div>
        <div className="text-sm text-slate-400">
          Журнал системных событий и ошибок
        </div>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 bg-slate-950/40 border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-0 shadow-xl backdrop-blur-sm">
        
        {/* Filters Bar */}
        <EventFilters 
          filters={filters}
          setFilterValue={setFilterValue}
          toggleLevel={toggleLevel}
          levelStats={levelStats}
          clearFilters={clearFilters}
          applyPreset={applyPreset}
          savedViews={savedViews}
          selectedSavedViewId={selectedSavedViewId}
          onSelectSavedView={(id) => applySavedView(id)}
          onSaveView={(name) => saveCurrentView(name)}
          onDeleteSavedView={(id) => deleteSavedView(id)}
          timePreset={timePreset}
          setTimePreset={setTimePreset}
          timeRange={timeRange}
          timeBucket={timeBucket}
          onClearTimeBucket={() => setTimeBucket(null)}
          clients={clients}
          loading={loading}
          eventCount={visibleEvents.length}
          lastUpdate={lastUpdate}
          isRefreshing={isRefreshing}
          refresh={refresh}
          autoRefreshEnabled={autoRefreshEnabled}
          setAutoRefreshEnabled={setAutoRefreshEnabled}
          onClearAllEvents={() => setClearConfirmOpen(true)}
          onExportCsv={exportCsv}
          onExportJson={exportJson}
          onMarkRead={markRead}
          viewMode={viewMode}
          groupBy={groupBy}
          onChangeViewMode={setViewMode}
          onChangeGroupBy={(by) => {
            setGroupBy(by);
            if (by !== 'time') setTimeBucket(null);
          }}
        />

        {/* Data Table */}
        <div className="flex-1 overflow-hidden relative">
            {loading && events.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-20">
                    <div className="text-slate-400 animate-pulse">Загрузка событий...</div>
                </div>
            ) : null}
            
            {viewMode === 'groups' ? (
              <EventGroups
                events={visibleEvents}
                groupBy={groupBy}
                onSelect={(row) => {
                  if (groupBy === 'time') {
                    if (!row.bucketFrom || !row.bucketTo || row.bucketTo.getTime() <= row.bucketFrom.getTime()) {
                      toast.warning({ title: 'Нельзя отфильтровать', message: 'Не удалось определить окно времени для этой группы.' });
                      return;
                    }
                    setTimeBucket({ from: row.bucketFrom, to: row.bucketTo });
                    setViewMode('list');
                    return;
                  }

                  // Reset time bucket when grouping by entity (less surprising UX)
                  if (timeBucket) setTimeBucket(null);

                  if (groupBy === 'client') {
                    if (!row.clientId) {
                      toast.warning({ title: 'Нельзя отфильтровать', message: 'У события нет clientId. Попробуйте группировку по инфобазе.' });
                      return;
                    }
                    setFilterValue('clientId', row.clientId);
                  } else {
                    if (!row.databaseName) {
                      toast.warning({ title: 'Нельзя отфильтровать', message: 'У события нет имени инфобазы.' });
                      return;
                    }
                    setFilterValue('database', row.databaseName);
                  }
                  setViewMode('list');
                }}
              />
            ) : (
              <EventTable 
                  events={visibleEvents}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  onEventClick={setSelectedEvent}
                  selectedEventId={selectedEvent?.id}
                  lastSeenUtcIso={lastSeenUtc}
              />
            )}
        </div>
      </div>

      {/* Details Modal */}
      <Drawer
        isOpen={!!selectedEvent}
        onClose={handleCloseModal}
        title="Детали события"
        size="lg"
      >
        {selectedEvent && (
          <EventDetails
            event={selectedEvent}
            setFilterValue={setFilterValue}
            onClose={handleCloseModal}
          />
        )}
      </Drawer>

      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Очистить все события?"
        description={
          <>
            <div>Все события будут удалены из журнала.</div>
            <div className="text-xs text-slate-400">Действие необратимо.</div>
          </>
        }
        confirmText="Очистить"
        cancelText="Отмена"
        variant="danger"
        onConfirm={() => {
          setClearConfirmOpen(false);
          handleClearEvents();
        }}
      />

    </div>
  );
};

export default Events;
