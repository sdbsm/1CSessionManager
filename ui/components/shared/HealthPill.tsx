import React from 'react';

interface HealthPillProps {
  label: string;
  status: 'ok' | 'warn' | 'fail' | 'unknown';
  hint?: string;
}

export const HealthPill: React.FC<HealthPillProps> = ({ label, status, hint }) => {
  const meta = status === 'ok'
    ? { dot: 'bg-emerald-400', text: 'OK', textCls: 'text-emerald-200' }
    : status === 'warn'
      ? { dot: 'bg-amber-400', text: 'DEGRADED', textCls: 'text-amber-200' }
      : status === 'fail'
        ? { dot: 'bg-rose-400', text: 'DOWN', textCls: 'text-rose-200' }
        : { dot: 'bg-slate-400', text: 'UNKNOWN', textCls: 'text-slate-300' };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className={`text-xs font-semibold ${meta.textCls}`}>{meta.text}</div>
      </div>
      {hint && <div className="ml-auto text-[11px] text-slate-500 truncate max-w-[280px]" title={hint}>{hint}</div>}
    </div>
  );
};
