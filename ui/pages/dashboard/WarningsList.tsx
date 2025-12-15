import React from 'react';
import { Database, CheckCircle2 } from 'lucide-react';
import { TopClient } from '../../hooks/useDashboardData';

interface WarningsListProps {
  warnings: TopClient[];
}

export const WarningsList: React.FC<WarningsListProps> = ({ warnings }) => {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-slate-300" />
          <div className="font-semibold text-slate-50">Клиенты под нагрузкой</div>
        </div>
        <button
          className="text-xs px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
          onClick={() => { window.location.hash = '#/clients'; }}
        >
          Управлять
        </button>
      </div>
      <div className="divide-y divide-white/5">
        {warnings.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-300" />
            Предупреждений нет
          </div>
        ) : (
          warnings.slice(0, 8).map(w => (
            <button
              key={w.id}
              type="button"
              className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
              onClick={() => {
                const isOver = w.status === 'blocked' || (w.utilization ?? 0) >= 100;
                const qp = new URLSearchParams();
                qp.set('clientId', w.id);
                qp.set('ops', isOver ? 'over' : 'risk');
                window.location.hash = `#/clients?${qp.toString()}`;
              }}
              title="Открыть детали клиента"
            >
              <span className={`w-2 h-2 rounded-full ${w.status === 'blocked' || (w.utilization ?? 0) >= 100 ? 'bg-rose-400' : 'bg-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-50 truncate">{w.name}</div>
                <div className="text-xs text-slate-400 truncate">{w.reason || `${w.activeSessions}/${w.maxSessions} (${w.utilization}%)`}</div>
              </div>
              <div className="text-xs font-mono text-slate-300">{w.activeSessions}/{w.maxSessions}</div>
              <div className="text-xs font-semibold text-slate-200">{w.utilization}%</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
