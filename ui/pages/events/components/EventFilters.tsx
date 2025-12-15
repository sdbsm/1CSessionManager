import React, { useMemo, useState } from 'react';
import { Filter, Search, X, RefreshCw, Trash2, Calendar, Download, Check, Save } from 'lucide-react';
import { AlertLevel, Client } from '../../../types';
import { TimeRangePreset, TimeRange } from '../../../hooks/useTimeRange';
import { EventsFilters, EventsPresetId } from '../../../hooks/useEvents';
import { ClientTypeahead } from './ClientTypeahead';
import { SavedEventsView } from '../../../hooks/useSavedEventViews';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

interface EventFiltersProps {
  filters: EventsFilters;
  setFilterValue: (key: keyof EventsFilters, value: any) => void;
  toggleLevel: (level: AlertLevel) => void;
  levelStats: { info: number; warning: number; critical: number };
  clearFilters: () => void;
  applyPreset: (preset: EventsPresetId) => void;
  savedViews: SavedEventsView[];
  selectedSavedViewId: string;
  onSelectSavedView: (id: string) => void;
  onSaveView: (name: string) => void;
  onDeleteSavedView: (id: string) => void;
  
  timePreset: TimeRangePreset;
  setTimePreset: (preset: TimeRangePreset) => void;
  timeRange: TimeRange;
  timeBucket?: { from: Date; to: Date } | null;
  onClearTimeBucket?: () => void;
  
  clients: Client[];
  
  // Status props
  loading: boolean;
  eventCount: number;
  lastUpdate: Date;
  isRefreshing: boolean;
  refresh: () => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (v: boolean) => void;
  onClearAllEvents: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onMarkRead: () => void;
  viewMode: 'list' | 'groups';
  groupBy: 'client' | 'infobase' | 'time';
  onChangeViewMode: (mode: 'list' | 'groups') => void;
  onChangeGroupBy: (by: 'client' | 'infobase' | 'time') => void;
}

function formatBucketLabel(from: Date, to: Date): string {
  const date = from.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const start = from.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const endInclusive = new Date(to.getTime() - 1000);
  const end = endInclusive.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${start}–${end}`;
}

const EventFilters: React.FC<EventFiltersProps> = ({
  filters,
  setFilterValue,
  toggleLevel,
  levelStats,
  clearFilters,
  applyPreset,
  savedViews,
  selectedSavedViewId,
  onSelectSavedView,
  onSaveView,
  onDeleteSavedView,
  timePreset,
  setTimePreset,
  timeRange,
  timeBucket,
  onClearTimeBucket,
  clients,
  loading,
  eventCount,
  lastUpdate,
  isRefreshing,
  refresh,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  onClearAllEvents,
  onExportCsv,
  onExportJson,
  onMarkRead,
  viewMode,
  groupBy,
  onChangeViewMode,
  onChangeGroupBy
}) => {
  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState('');

  const selectedName = useMemo(() => {
    return savedViews.find(v => v.id === selectedSavedViewId)?.name || '';
  }, [savedViews, selectedSavedViewId]);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 5) return 'только что';
    if (diff < 60) return `${diff}с назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
    return date.toLocaleTimeString('ru-RU');
  };

  const bucketLabel = useMemo(() => {
    if (!timeBucket) return '';
    return formatBucketLabel(timeBucket.from, timeBucket.to);
  }, [timeBucket]);

  const hasActiveFilters = 
    filters.search || 
    filters.clientId || 
    filters.database || 
    filters.user || 
    filters.levels.size !== 3 ||
    !!timeBucket;

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-950/40 border-b border-white/10">
      
      {/* Top Row: Search, Time, Levels, Actions */}
      <div className="flex flex-wrap items-center gap-3">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            value={filters.search}
            onChange={(e) => setFilterValue('search', e.target.value)}
            placeholder="Поиск по сообщению..."
            className="w-full pl-9 pr-9 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          {filters.search && (
            <button
              onClick={() => setFilterValue('search', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1">
          <div className="flex items-center px-2 text-slate-400">
            <Calendar size={14} />
          </div>
          <select
            value={timePreset}
            onChange={(e) => setTimePreset(e.target.value as any)}
            className="bg-transparent text-sm text-slate-200 focus:outline-none border-none py-0.5"
          >
            <option value="1h" className="bg-slate-900">1 час</option>
            <option value="2h" className="bg-slate-900">2 часа</option>
            <option value="6h" className="bg-slate-900">6 часов</option>
            <option value="24h" className="bg-slate-900">1 день</option>
            <option value="7d" className="bg-slate-900">1 неделя</option>
            <option value="30d" className="bg-slate-900">1 месяц</option>
          </select>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          {([
            { id: 'all', label: 'Все' },
            { id: 'critical', label: 'Critical' },
            { id: 'warning', label: 'Warning' },
            { id: 'cluster', label: 'Кластер' },
            { id: 'sql', label: 'SQL' }
          ] as Array<{ id: EventsPresetId; label: string }>).map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onClearTimeBucket?.();
                applyPreset(p.id);
              }}
              className="px-2 py-1 rounded text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-white/10 transition-colors"
              title="Быстро применить представление"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Saved views */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
          <span className="text-xs text-slate-500">Представление:</span>
          <select
            value={selectedSavedViewId}
            onChange={(e) => onSelectSavedView(e.target.value)}
            className="bg-transparent text-xs text-slate-200 focus:outline-none border-none py-0.5 min-w-[160px]"
            title="Сохранённые представления"
          >
            <option value="" className="bg-slate-900">Не выбрано</option>
            {savedViews.map(v => (
              <option key={v.id} value={v.id} className="bg-slate-900">
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setName('');
              setSaveOpen(true);
            }}
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            title="Сохранить текущее представление"
          >
            <Save size={14} />
          </button>
          <button
            type="button"
            disabled={!selectedSavedViewId}
            onClick={() => setDeleteOpen(true)}
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={selectedSavedViewId ? 'Удалить выбранное представление' : 'Сначала выберите сохранённое представление'}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          <button
            type="button"
            onClick={() => onChangeViewMode('list')}
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
              viewMode === 'list' ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`}
            title="Список событий"
          >
            Список
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('groups')}
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
              viewMode === 'groups' ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`}
            title="Группировка"
          >
            Группы
          </button>
          {viewMode === 'groups' && (
            <select
              value={groupBy}
              onChange={(e) => onChangeGroupBy(e.target.value as any)}
              className="ml-1 bg-transparent text-xs text-slate-200 focus:outline-none border-none py-0.5"
              title="Группировать по"
            >
              <option value="client" className="bg-slate-900">по клиенту</option>
              <option value="infobase" className="bg-slate-900">по инфобазе</option>
              <option value="time" className="bg-slate-900">по времени</option>
            </select>
          )}
        </div>

        {/* Levels */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
          {(['critical', 'warning', 'info'] as AlertLevel[]).map(level => {
             const active = filters.levels.has(level);
             const colorClass = level === 'critical' ? 'text-rose-400' : level === 'warning' ? 'text-amber-400' : 'text-sky-400';
             
             return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`
                  px-2 py-1 rounded text-xs font-medium transition-all
                  ${active 
                    ? 'bg-white/10 text-slate-100 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }
                `}
              >
                <span className={active ? colorClass : ''}>{level.toUpperCase()}</span>
                <span className="ml-1.5 opacity-60 text-[10px]">{levelStats[level]}</span>
              </button>
             );
          })}
        </div>
        
        <div className="flex-1" />

        {/* Refresh & Actions */}
        <div className="flex items-center gap-2">
            <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    autoRefreshEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' 
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
            >
                {autoRefreshEnabled ? 'Live' : 'Paused'}
            </button>

            <button
                onClick={refresh}
                className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                title="Обновить"
            >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={onExportCsv}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
              title="Экспорт CSV"
            >
              <Download size={14} />
            </button>
            <button
              onClick={onExportJson}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
              title="Экспорт JSON"
            >
              <Download size={14} />
            </button>

            <button
              onClick={onMarkRead}
              className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-200 transition-colors"
              title="Отметить прочитанными (сбросить +N новых)"
            >
              <Check size={14} />
            </button>

             <button
              onClick={onClearAllEvents}
              className="p-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 transition-colors"
              title="Очистить все события"
            >
              <Trash2 size={14} />
            </button>
        </div>
      </div>

      {/* Second Row: Specific Filters */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Filter size={14} className="text-slate-500" />

        {timeBucket ? (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
            <span className="text-xs text-slate-500">Окно:</span>
            <span className="text-xs font-mono text-slate-200" title="Фильтр по окну времени внутри текущего диапазона">
              {bucketLabel}
            </span>
            <button
              type="button"
              onClick={() => onClearTimeBucket?.()}
              className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5"
              title="Сбросить окно"
              aria-label="Сбросить окно времени"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
        
        {/* Client Selector */}
        <ClientTypeahead
          clients={clients}
          valueClientId={filters.clientId}
          onChangeClientId={(id) => setFilterValue('clientId', id)}
        />

        {/* DB Input */}
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Инфобаза:</span>
            <input 
                value={filters.database}
                onChange={(e) => setFilterValue('database', e.target.value)}
                placeholder="имя..."
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-[120px]"
            />
        </div>

        {/* User Input */}
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Пользователь:</span>
            <input 
                value={filters.user}
                onChange={(e) => setFilterValue('user', e.target.value)}
                placeholder="имя..."
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-[120px]"
            />
        </div>

        {hasActiveFilters && (
            <button 
                onClick={() => {
                  onClearTimeBucket?.();
                  clearFilters();
                }}
                className="ml-auto text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
            >
                <X size={12} /> Сбросить фильтры
            </button>
        )}
        
        <div className="ml-auto text-xs text-slate-500">
            {loading ? 'Загрузка...' : `${eventCount} событий`} 
            <span className="mx-2 opacity-50">|</span>
            {lastUpdate.getTime() > 0 ? formatRelativeTime(lastUpdate) : ''}
        </div>
      </div>

      <Modal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Сохранить представление"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>Отмена</Button>
            <Button
              onClick={() => {
                const trimmed = name.trim();
                if (!trimmed) return;
                onSaveView(trimmed);
                setSaveOpen(false);
              }}
              disabled={!name.trim()}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            Сохранит текущие фильтры + режим (Список/Группы) и тип группировки.
          </div>
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Critical + SQL + 24h"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Удалить представление?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Отмена</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!selectedSavedViewId) return;
                onDeleteSavedView(selectedSavedViewId);
                setDeleteOpen(false);
              }}
              disabled={!selectedSavedViewId}
            >
              Удалить
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-slate-300">
          <div>
            Будет удалено представление: <b className="text-slate-100">{selectedName || '—'}</b>
          </div>
          <div className="text-xs text-slate-500">Это локально (в этом браузере). Действие необратимо.</div>
        </div>
      </Modal>
    </div>
  );
};

export default EventFilters;
