import React from 'react';
import { SystemEvent } from '../../../types';
import { SeverityBadge } from '../../../components/shared/SeverityBadge';
import { Filter, Copy } from 'lucide-react';
import { EventsFilters } from '../../../hooks/useEvents';
import { useUiPrefs } from '../../../hooks/useUiPrefs';
import { formatEventTimestamp } from '../../../utils/time';

interface EventDetailsProps {
  event: SystemEvent;
  setFilterValue: (key: keyof EventsFilters, value: any) => void;
  onClose: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ event, setFilterValue, onClose }) => {
  const { prefs } = useUiPrefs();
  const ts = formatEventTimestamp(event, prefs.timeFormat);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <SeverityBadge level={event.level} />
        <span className="font-mono">
            <span title={ts.title || undefined}>{ts.text}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-xs text-slate-500">{event.id}</span>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Сообщение</span>
            <button 
                onClick={() => copyToClipboard(event.message)}
                className="flex items-center gap-1 hover:text-slate-200"
            >
                <Copy size={12} /> Копировать
            </button>
        </div>
        <div className="bg-black/30 rounded-lg border border-white/5 p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-all">
                {event.message}
            </pre>
        </div>
      </div>

      {/* Context Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 border-b border-white/10 pb-1">Контекст</h4>
            
            <div className="space-y-2 text-sm">
                {event.clientName ? (
                    <div className="flex items-center justify-between group">
                        <span className="text-slate-400">Клиент:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-200">{event.clientName}</span>
                            <button 
                                onClick={() => { setFilterValue('clientId', event.clientId || ''); onClose(); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-indigo-300"
                                title="Фильтровать по клиенту"
                            >
                                <Filter size={12} />
                            </button>
                        </div>
                    </div>
                ) : null}

                {event.databaseName ? (
                    <div className="flex items-center justify-between group">
                        <span className="text-slate-400">Инфобаза:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-200">{event.databaseName}</span>
                            <button 
                                onClick={() => { setFilterValue('database', event.databaseName || ''); onClose(); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-indigo-300"
                                title="Фильтровать по инфобазе"
                            >
                                <Filter size={12} />
                            </button>
                        </div>
                    </div>
                ) : null}

                {event.userName ? (
                    <div className="flex items-center justify-between group">
                        <span className="text-slate-400">Пользователь:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-200">{event.userName}</span>
                            <button 
                                onClick={() => { setFilterValue('user', event.userName || ''); onClose(); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-indigo-300"
                                title="Фильтровать по пользователю"
                            >
                                <Filter size={12} />
                            </button>
                        </div>
                    </div>
                ) : null}
                
                {!event.clientName && !event.databaseName && !event.userName && (
                    <div className="text-slate-500 italic">Нет контекста</div>
                )}
            </div>
        </div>

        <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 border-b border-white/10 pb-1">Техническая инфо</h4>
            <div className="space-y-2 text-sm">
                {event.sessionId && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Session ID:</span>
                        <span className="font-mono text-slate-200 text-xs">{event.sessionId}</span>
                    </div>
                )}
                 <div className="flex justify-between">
                    <span className="text-slate-400">ID события:</span>
                    <span className="font-mono text-slate-200 text-xs truncate max-w-[150px]" title={event.id}>{event.id}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp UTC:</span>
                    <span className="font-mono text-slate-200 text-xs">{event.timestampUtc}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
