
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import { SystemEvent, AlertLevel } from '../types';
import { apiFetch } from '../services/apiClient';

interface EventsProps {
  events: SystemEvent[];
  onEventsChange?: () => void;
}

type SortField = 'timestamp' | 'level';
type SortDirection = 'asc' | 'desc';

const Events: React.FC<EventsProps> = ({ events, onEventsChange }) => {
  // Filter states
  const [selectedLevels, setSelectedLevels] = useState<Set<AlertLevel>>(
    new Set(['info', 'warning', 'critical'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort states
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Auto-refresh states
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Clear state
  const [isClearing, setIsClearing] = useState(false);

  // Update last update time when events change
  useEffect(() => {
    if (events.length > 0) {
      setLastUpdate(new Date());
    }
  }, [events]);

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefreshEnabled || !onEventsChange) return;
    
    const interval = setInterval(() => {
      setIsRefreshing(true);
      onEventsChange();
      setTimeout(() => setIsRefreshing(false), 500);
    }, 10000); // 10 seconds
    
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, onEventsChange]);

  // Filter and search logic
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Level filter
      if (!selectedLevels.has(event.level)) return false;
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return event.message.toLowerCase().includes(query) ||
               event.timestamp.toLowerCase().includes(query);
      }
      
      return true;
    });
  }, [events, selectedLevels, searchQuery]);

  // Sort logic
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    
    sorted.sort((a, b) => {
      if (sortField === 'timestamp') {
        // Parse timestamps for comparison
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        // Sort by level: critical > warning > info
        const levelOrder = { critical: 3, warning: 2, info: 1 };
        const orderA = levelOrder[a.level] || 0;
        const orderB = levelOrder[b.level] || 0;
        return sortDirection === 'desc' ? orderB - orderA : orderA - orderB;
      }
    });
    
    return sorted;
  }, [filteredEvents, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvents = sortedEvents.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLevels, searchQuery, sortField, sortDirection]);

  // Level statistics
  const levelStats = useMemo(() => {
    const stats = { info: 0, warning: 0, critical: 0 };
    events.forEach(event => {
      stats[event.level]++;
    });
    return stats;
  }, [events]);

  // Toggle level filter
  const toggleLevel = (level: AlertLevel) => {
    const newLevels = new Set(selectedLevels);
    if (newLevels.has(level)) {
      newLevels.delete(level);
    } else {
      newLevels.add(level);
    }
    setSelectedLevels(newLevels);
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Clear all events
  const handleClearEvents = async () => {
    if (!window.confirm('Вы уверены, что хотите очистить все события? Это действие необратимо.')) {
      return;
    }
    
    setIsClearing(true);
    try {
      const res = await apiFetch('/api/events', {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onEventsChange) {
          onEventsChange();
        }
        alert('Все события успешно очищены');
      } else {
        alert('Ошибка при очистке событий');
      }
    } catch (error) {
      console.error('Error clearing events:', error);
      alert('Ошибка соединения');
    } finally {
      setIsClearing(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 10) return 'только что';
    if (diff < 60) return `${diff} секунд назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)} минут назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} часов назад`;
    return date.toLocaleString('ru-RU');
  };

  // Highlight search text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
      ) : part
    );
  };

  const getLevelIcon = (level: AlertLevel) => {
    switch (level) {
      case 'critical':
        return <AlertCircle size={14} />;
      case 'warning':
        return <AlertTriangle size={14} />;
      default:
        return <Info size={14} />;
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Журнал событий</h1>
        <div className="flex items-center gap-3">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {isRefreshing && <RefreshCw className="animate-spin" size={16} />}
            <span>
              {autoRefreshEnabled ? `Обновлено ${formatRelativeTime(lastUpdate)}` : 'Автообновление отключено'}
            </span>
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className="text-xs text-indigo-600 hover:text-indigo-700 underline"
            >
              {autoRefreshEnabled ? 'Отключить' : 'Включить'}
            </button>
          </div>
          
          {/* Clear button */}
          <button
            onClick={handleClearEvents}
            disabled={isClearing || events.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Trash2 size={16} />
            {isClearing ? 'Очистка...' : 'Очистить все'}
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Поиск по сообщению или времени..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Level Filters */}
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-500" />
            <span className="text-sm text-slate-600 font-medium">Уровень:</span>
            {(['info', 'warning', 'critical'] as AlertLevel[]).map(level => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  selectedLevels.has(level)
                    ? level === 'info' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                      level === 'warning' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                      'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                }`}
              >
                {getLevelIcon(level)}
                {level.toUpperCase()}
                <span className="text-slate-500">({levelStats[level]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-slate-500">
          Показано {paginatedEvents.length} из {sortedEvents.length} событий
          {searchQuery && ` (найдено по запросу "${searchQuery}")`}
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-500">
                  <button
                    onClick={() => handleSort('timestamp')}
                    className="flex items-center gap-2 hover:text-slate-700 transition-colors"
                  >
                    Время
                    {sortField === 'timestamp' && (
                      sortDirection === 'desc' ? <ChevronDown size={16} /> : <ChevronUp size={16} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 font-medium text-slate-500">
                  <button
                    onClick={() => handleSort('level')}
                    className="flex items-center gap-2 hover:text-slate-700 transition-colors"
                  >
                    Уровень
                    {sortField === 'level' && (
                      sortDirection === 'desc' ? <ChevronDown size={16} /> : <ChevronUp size={16} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 font-medium text-slate-500">Сообщение</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                    {searchQuery || selectedLevels.size < 3
                      ? 'События не найдены'
                      : 'События отсутствуют'}
                  </td>
                </tr>
              ) : (
                paginatedEvents.map(event => (
                  <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {event.timestamp}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        event.level === 'info' ? 'bg-blue-100 text-blue-800' :
                        event.level === 'warning' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {getLevelIcon(event.level)}
                        {event.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-800">
                      {highlightText(event.message, searchQuery)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                Страница {currentPage} из {totalPages}
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={10}>10 на странице</option>
                <option value={20}>20 на странице</option>
                <option value={50}>50 на странице</option>
                <option value={100}>100 на странице</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;


