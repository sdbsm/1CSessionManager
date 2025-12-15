import React from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Briefcase, Database, User, Hash } from 'lucide-react';
import { SystemEvent, AlertLevel } from '../../../types';
import { SortField, SortDirection } from '../../../hooks/useEvents';
import { useUiPrefs } from '../../../hooks/useUiPrefs';
import { formatEventTimestamp } from '../../../utils/time';

interface EventTableProps {
  events: SystemEvent[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onEventClick: (event: SystemEvent) => void;
  selectedEventId?: string;
  lastSeenUtcIso?: string | null;
}

function getLevelIcon(level: AlertLevel) {
  switch (level) {
    case AlertLevel.CRITICAL: return <AlertCircle size={14} className="text-rose-400" />;
    case AlertLevel.WARNING: return <AlertTriangle size={14} className="text-amber-400" />;
    default: return <Info size={14} className="text-sky-400" />;
  }
}

function eventDateUtc(e: SystemEvent): Date {
  if (e.timestampUtc) return new Date(e.timestampUtc);
  if (e.timestamp) return new Date(e.timestamp);
  if (e.timestampLocal) return new Date(e.timestampLocal);
  return new Date(0);
}

const EventTable: React.FC<EventTableProps> = ({
  events,
  sortField,
  sortDirection,
  onSort,
  onEventClick,
  selectedEventId,
  lastSeenUtcIso
}) => {
  const { prefs } = useUiPrefs();
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <div className="mb-2">События не найдены</div>
        <div className="text-xs">Попробуйте изменить фильтры или диапазон времени</div>
      </div>
    );
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <ChevronDown size={14} className="ml-1 inline" /> : <ChevronUp size={14} className="ml-1 inline" />;
  };

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-slate-950 z-10 shadow-sm border-b border-white/10">
          <tr>
            <th 
                className="px-4 py-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-200 select-none w-[180px]"
                onClick={() => onSort('timestamp')}
            >
                Время {renderSortIcon('timestamp')}
            </th>
            <th 
                className="px-4 py-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-200 select-none w-[100px]"
                onClick={() => onSort('level')}
            >
                Уровень {renderSortIcon('level')}
            </th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400 w-[250px]">
                Источник
            </th>
            <th className="px-4 py-2 text-xs font-semibold text-slate-400">
                Сообщение
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm">
          {events.map(ev => {
             const ts = formatEventTimestamp(ev, prefs.timeFormat);
             const isSelected = ev.id === selectedEventId;
             const lastSeen = lastSeenUtcIso ? new Date(lastSeenUtcIso) : null;
             const isNew = !!lastSeen && eventDateUtc(ev).getTime() > lastSeen.getTime();

             return (
              <tr 
                key={ev.id} 
                className={`
                    cursor-pointer transition-colors
                    ${isSelected ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : isNew ? 'bg-sky-500/5 hover:bg-sky-500/10' : 'hover:bg-white/5'}
                `}
                onClick={() => onEventClick(ev)}
              >
                <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} text-xs font-mono text-slate-400 whitespace-nowrap align-top`}>
                    <div className="flex items-center gap-2">
                      {isNew ? <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Новое событие" /> : null}
                      <span title={ts.title || undefined}>{ts.text}</span>
                    </div>
                </td>
                <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} align-top`}>
                    <div className="flex items-center gap-2">
                        {getLevelIcon(ev.level)}
                        <span className={`text-xs font-medium ${
                            ev.level === AlertLevel.CRITICAL ? 'text-rose-300' : 
                            ev.level === AlertLevel.WARNING ? 'text-amber-300' : 'text-sky-300'
                        }`}>
                            {ev.level.toUpperCase()}
                        </span>
                    </div>
                </td>
                <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} align-top`}>
                   <div className="flex flex-col gap-1 items-start">
                     {ev.clientName && (
                       <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 max-w-full" title={`Клиент: ${ev.clientName}`}>
                         <Briefcase size={10} className="shrink-0" />
                         <span className="text-[10px] font-medium truncate">{ev.clientName}</span>
                       </div>
                     )}
                     {ev.databaseName && (
                      <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10 max-w-full" title={`Инфобаза: ${ev.databaseName}`}>
                         <Database size={10} className="shrink-0" />
                         <span className="text-[10px] font-medium truncate">{ev.databaseName}</span>
                       </div>
                     )}
                     {ev.userName && (
                       <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-slate-400 max-w-full" title={`Пользователь: ${ev.userName}`}>
                         <User size={10} className="shrink-0" />
                         <span className="text-[10px] truncate">{ev.userName}</span>
                       </div>
                     )}
                     {!ev.clientName && !ev.databaseName && !ev.userName && (
                       <span className="text-xs text-slate-600">—</span>
                     )}
                   </div>
                </td>
                <td className={`px-4 ${prefs.density === 'compact' ? 'py-1.5' : 'py-2'} text-slate-200 font-mono text-xs align-top`}>
                    <div className="break-all whitespace-pre-wrap max-h-[4.5em] overflow-hidden text-ellipsis line-clamp-3" title={ev.message}>
                        {ev.message}
                    </div>
                </td>
              </tr>
             );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default EventTable;
