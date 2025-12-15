import React from 'react';
import { Filter, Search, X, RefreshCw, Trash2, Calendar } from 'lucide-react';
import { AlertLevel, Client } from '../../../types';
import { TimeRangePreset, TimeRange } from '../../../hooks/useTimeRange';
import { EventsFilters } from '../../../hooks/useEvents';

interface EventFiltersProps {
  filters: EventsFilters;
  setFilterValue: (key: keyof EventsFilters, value: any) => void;
  toggleLevel: (level: AlertLevel) => void;
  levelStats: { info: number; warning: number; critical: number };
  clearFilters: () => void;
  
  timePreset: TimeRangePreset;
  setTimePreset: (preset: TimeRangePreset) => void;
  timeRange: TimeRange;
  
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
}

function getLevelIcon(level: AlertLevel) {
  // We can reuse icons from lucide, maybe import from a shared helper if available, 
  // but for now simplest is to just render them here or accept a render prop.
  // The original used: AlertCircle (critical), AlertTriangle (warning), Info (info)
  return null; // Will be handled by parent or we duplicate logic? 
  // Let's implement simple icons here to be self contained or import.
}

const EventFilters: React.FC<EventFiltersProps> = ({
  filters,
  setFilterValue,
  toggleLevel,
  levelStats,
  clearFilters,
  timePreset,
  setTimePreset,
  timeRange,
  clients,
  loading,
  eventCount,
  lastUpdate,
  isRefreshing,
  refresh,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  onClearAllEvents
}) => {
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 5) return 'только что';
    if (diff < 60) return `${diff}с назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
    return date.toLocaleTimeString('ru-RU');
  };

  const hasActiveFilters = 
    filters.search || 
    filters.clientId || 
    filters.database || 
    filters.user || 
    filters.levels.size !== 3;

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
        
        {/* Client Selector */}
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Клиент:</span>
            <select
                value={filters.clientId}
                onChange={(e) => setFilterValue('clientId', e.target.value)}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50 max-w-[150px]"
            >
                <option value="" className="bg-slate-900">Все</option>
                {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                ))}
            </select>
        </div>

        {/* DB Input */}
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">БД:</span>
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
                onClick={clearFilters}
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
    </div>
  );
};

export default EventFilters;
