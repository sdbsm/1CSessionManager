import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SeverityBadge } from '../../components/shared/SeverityBadge';
import { DashboardStats, TopClient } from '../../hooks/useDashboardData';

interface ActiveIssuesProps {
  stats: DashboardStats | null;
  dbEndpointStatus: 'set' | 'not_set' | 'unknown';
  sqlLoginStatus: 'set' | 'not_set' | 'unknown';
  criticalClientsCount: number;
  warnings: TopClient[];
  licenseCap: number | null;
}

export const ActiveIssues: React.FC<ActiveIssuesProps> = ({
  stats,
  dbEndpointStatus,
  sqlLoginStatus,
  criticalClientsCount,
  warnings,
  licenseCap
}) => {
  const issues = useMemo(() => {
    const list: Array<{
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      action?: { label: string; run: () => void };
    }> = [];

    if (stats?.clusterStatus === 'offline') {
      list.push({
        severity: 'critical',
        title: 'Кластер 1С недоступен',
        description: 'RAC/RAS не вернули список кластеров. Проверьте RAS host, учётку и доступность rac.exe.',
        action: { label: 'Открыть события', run: () => { window.location.hash = '#/events?levels=critical,warning&q=cluster'; } }
      });
    } else if (stats?.clusterStatus === 'unknown') {
      list.push({
        severity: 'warning',
        title: 'Не удалось определить статус кластера 1С',
        description: 'Сервис не смог получить данные RAC/RAS. Проверьте настройки и журнал событий.',
        action: { label: 'Открыть события', run: () => { window.location.hash = '#/events?levels=critical,warning'; } }
      });
    }

    if (dbEndpointStatus === 'not_set' || sqlLoginStatus === 'not_set') {
      list.push({
        severity: 'warning',
        title: 'База данных не настроена полностью',
        description: 'Для хранения метрик/событий требуется DB endpoint и SQL login (Credential Manager).',
        action: { label: 'Открыть настройки', run: () => { window.location.hash = '#/settings'; } }
      });
    }

    if (criticalClientsCount > 0) {
      list.push({
        severity: 'warning',
        title: 'Есть клиенты на лимите/в блокировке',
        description: `Критичных клиентов: ${criticalClientsCount}. Проверьте квоты и политику ограничений.`,
        action: { label: 'Открыть клиентов', run: () => { window.location.hash = '#/clients'; } }
      });
    }

    if (warnings.length > 0) {
      list.push({
        severity: warnings.some(w => (w.utilization ?? 0) >= 100 || w.status === 'blocked') ? 'critical' : 'warning',
        title: 'Активные предупреждения по квотам',
        description: `Предупреждений: ${warnings.length}. Есть риск деградации/кика сессий.`,
        action: { label: 'Открыть клиентов', run: () => { window.location.hash = '#/clients'; } }
      });
    }

    if (!licenseCap) {
      list.push({
        severity: 'info',
        title: 'Лицензии не заданы',
        description: 'Укажите “Всего лицензий” в Настройках → Setup, чтобы загрузка считалась по реальным лицензиям сервера.',
        action: { label: 'Открыть настройки', run: () => { window.location.hash = '#/settings'; } }
      });
    }

    if (list.length === 0) {
      list.push({
        severity: 'info',
        title: 'Активных проблем не найдено',
        description: 'Система выглядит стабильной в выбранном диапазоне времени.',
      });
    }

    return list;
  }, [stats?.clusterStatus, dbEndpointStatus, sqlLoginStatus, criticalClientsCount, warnings, licenseCap]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-300" />
          <div className="font-semibold text-slate-50">Active Issues</div>
        </div>
        <button
          className="text-xs px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
          onClick={() => { window.location.hash = '#/events?levels=critical,warning'; }}
        >
          Открыть события
        </button>
      </div>
      <div className="divide-y divide-white/5">
        {issues.map((it, idx) => (
          <div key={idx} className="px-5 py-4 flex items-start gap-3">
            <SeverityBadge level={it.severity} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-50">{it.title}</div>
              <div className="text-sm text-slate-400">{it.description}</div>
            </div>
            {it.action && (
              <button
                className="text-xs px-3 py-1.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-100"
                onClick={it.action.run}
              >
                {it.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
