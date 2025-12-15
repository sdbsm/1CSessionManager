import React from 'react';
import { FileText, XCircle } from 'lucide-react';
import { SystemEvent } from '../../types';
import { SeverityBadge } from '../../components/shared/SeverityBadge';

interface RecentEventsProps {
  events: SystemEvent[];
}

export const RecentEvents: React.FC<RecentEventsProps> = ({ events }) => {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-slate-300" />
          <div className="font-semibold text-slate-50">Последние события (warn+)</div>
        </div>
        <button
          className="text-xs px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
          onClick={() => { window.location.hash = '#/events?levels=critical,warning'; }}
        >
          Открыть журнал
        </button>
      </div>
      <div className="divide-y divide-white/5">
        {events.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400 flex items-center gap-2">
            <XCircle size={18} className="text-slate-500" />
            Нет событий за выбранный диапазон
          </div>
        ) : (
          events.slice(0, 10).map(ev => (
            <div
              key={ev.id}
              className="px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => {
                const qp = new URLSearchParams();
                qp.set('levels', 'critical,warning');
                if (ev.clientId) qp.set('clientId', ev.clientId);
                window.location.hash = `#/events?${qp.toString()}`;
              }}
              title="Открыть в журнале событий"
            >
              <div className="flex items-center gap-3">
                <SeverityBadge level={ev.level as any} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-100 truncate">{ev.message}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {(ev.timestampLocal || ev.timestampUtc || ev.timestamp || '').toString()}
                    {ev.clientName ? ` · ${ev.clientName}` : ''}
                    {ev.databaseName ? ` · ${ev.databaseName}` : ''}
                    {ev.userName ? ` · ${ev.userName}` : ''}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
