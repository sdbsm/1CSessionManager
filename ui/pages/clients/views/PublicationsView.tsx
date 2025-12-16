import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { ActionMenu } from '../../../components/ui/ActionMenu';
import { RefreshCw, Trash2 } from 'lucide-react';
import { AgentCommandDto, AgentPublicationDto, PublicationsRoute, AgentCommandStatus } from '../../../../types';
import { apiFetchJson } from '../../../services/apiClient';
import { useToast } from '../../../hooks/useToast';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { formatRelativeShort } from '../../../utils/time';

interface PublicationsViewProps {
  publications: AgentPublicationDto[];
  agentId: string | null;
  versions: string[];
  
  // Filters (controlled by parent for URL sync)
  search: string;
  onSearchChange: (v: string) => void;
  versionFilter: string;
  onVersionFilterChange: (v: string) => void;
  siteFilter: string;
  onSiteFilterChange: (v: string) => void;
  route: PublicationsRoute;
  onRouteChange: (r: PublicationsRoute) => void;

  onEditPublication: (dbName: string, pub: AgentPublicationDto) => void;
}

export const PublicationsView: React.FC<PublicationsViewProps> = ({
  publications,
  agentId,
  versions,
  search,
  onSearchChange,
  versionFilter,
  onVersionFilterChange,
  siteFilter,
  onSiteFilterChange,
  route,
  onRouteChange,
  onEditPublication
}) => {
  const toast = useToast();
  
  // Local state for mass update
  const [massSource, setMassSource] = useState('');
  const [massTarget, setMassTarget] = useState('');
  const [massConfirmOpen, setMassConfirmOpen] = useState(false);

  // Agent commands state
  const [agentCommands, setAgentCommands] = useState<AgentCommandDto[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [commandsLastUpdate, setCommandsLastUpdate] = useState<Date>(new Date(0));
  const [clearingOld, setClearingOld] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const hasInFlightCommands = useMemo(() => {
    return agentCommands.some(c => c.status === 'Pending' || c.status === 'Processing');
  }, [agentCommands]);

  const fetchAgentCommands = async () => {
    if (!agentId) return;
    setCommandsLoading(true);
    try {
      const rows = await apiFetchJson<AgentCommandDto[]>(`/api/agents/${agentId}/commands?take=30`);
      setAgentCommands(rows || []);
      setCommandsLastUpdate(new Date());
    } catch (e) {
      console.warn('Failed to load agent commands', e);
    } finally {
      setCommandsLoading(false);
    }
  };

  const clearOldCommands = async (daysOld: number = 7) => {
    if (!agentId) return;
    setClearingOld(true);
    try {
      const result = await apiFetchJson<{ deletedCount: number; cutoffDate: string }>(
        `/api/agents/${agentId}/commands/old?daysOld=${daysOld}`,
        { method: 'DELETE' }
      );
      toast.success({ 
        title: 'Очистка завершена', 
        message: `Удалено записей: ${result.deletedCount}` 
      });
      // Refresh commands list
      await fetchAgentCommands();
    } catch (e: any) {
      toast.error({ 
        title: 'Ошибка очистки', 
        message: e?.message ? String(e.message) : 'Не удалось очистить старые записи.' 
      });
    } finally {
      setClearingOld(false);
      setClearConfirmOpen(false);
    }
  };

  useEffect(() => {
    if (!agentId) return;
    fetchAgentCommands();
    const id = window.setInterval(() => fetchAgentCommands(), hasInFlightCommands ? 5_000 : 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, hasInFlightCommands]);

  const sendCommand = async (type: string, payload: any) => {
    if (!agentId) return;
    try {
      const res = await apiFetchJson<{ commandId: string }>(`/api/agents/${agentId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payloadJson: JSON.stringify(payload) })
      });
      const commandId = res?.commandId;
      if (commandId) {
        const optimistic: AgentCommandDto = {
          id: commandId,
          commandType: type,
          status: 'Pending',
          errorMessage: null,
          progressPercent: 0,
          progressMessage: 'Ожидание агента...',
          startedAtUtc: null,
          lastUpdatedAtUtc: new Date().toISOString(),
          createdAtUtc: new Date().toISOString(),
          processedAtUtc: null
        };
        setAgentCommands(prev => [optimistic, ...prev].slice(0, 30));
        setCommandsLastUpdate(new Date());
      }
      toast.success({ title: 'Команда отправлена', message: 'Статус смотрите в очереди агента.' });
    } catch (e: any) {
      toast.error({ title: 'Ошибка', message: e?.message ? String(e.message) : 'Не удалось отправить команду агенту.' });
    }
  };

  const executeMassUpdate = () => {
    if (!massTarget) return;
    sendCommand('MassUpdateVersions', {
      SourceVersion: massSource,
      TargetVersion: massTarget
    });
    onRouteChange('list');
    setMassConfirmOpen(false);
  };

  const affectedPublicationsCount = useMemo(() => {
    if (!massTarget) return 0;
    return publications.filter(p => {
      if (!massSource) return true;
      return (p.version || '') === massSource;
    }).length;
  }, [publications, massSource, massTarget]);

  const pubSites = useMemo(() => {
    const s = new Set<string>();
    for (const p of publications) {
      const site = (p.siteName || '').trim();
      if (site) s.add(site);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [publications]);

  const filteredPublications = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ver = (versionFilter || '').trim();
    const site = (siteFilter || '').trim();
    return publications.filter(p => {
      if (ver && (p.version || '') !== ver) return false;
      if (site && (p.siteName || '') !== site) return false;
      if (!q) return true;
      const hay = `${p.siteName || ''} ${p.appPath || ''} ${p.physicalPath || ''} ${p.version || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [publications, search, versionFilter, siteFilter]);

  const cmdCounts = useMemo(() => {
    let pending = 0, processing = 0, failed = 0;
    for (const c of agentCommands) {
      if (c.status === 'Pending') pending++;
      else if (c.status === 'Processing') processing++;
      else if (c.status === 'Failed') failed++;
    }
    return { pending, processing, failed };
  }, [agentCommands]);

  const formatDuration = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    if (totalSec < 60) return `${totalSec}с`;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m < 60) return `${m}м ${s}с`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}ч ${mm}м`;
  };

  const etaFor = (c: AgentCommandDto) => {
    if (c.status !== 'Processing') return null;
    const p = typeof c.progressPercent === 'number' ? c.progressPercent : null;
    if (p == null || p <= 0 || p >= 100) return null;
    if (!c.startedAtUtc) return null;
    const started = new Date(c.startedAtUtc);
    if (Number.isNaN(started.getTime())) return null;
    const elapsed = Date.now() - started.getTime();
    if (elapsed <= 0) return null;
    const remaining = Math.floor(elapsed * (100 - p) / p);
    if (remaining <= 0) return null;
    return `≈ ${formatDuration(remaining)}`;
  };

  const commandBadge = (status: AgentCommandStatus) => {
    const st = (status || '').toString();
    if (st === 'Completed') return <Badge variant="success" size="sm">Готово</Badge>;
    if (st === 'Failed') return <Badge variant="danger" size="sm">Ошибка</Badge>;
    if (st === 'Processing') return <Badge variant="warning" size="sm">В работе</Badge>;
    if (st === 'Pending') return <Badge variant="neutral" size="sm">В очереди</Badge>;
    return <Badge variant="neutral" size="sm">{st || '—'}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Agent Queue */}
      <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-50">Очередь агента (команды)</div>
            <div className="text-xs text-slate-400 mt-1">В очереди → В работе → Готово / Ошибка</div>
          </div>
          <div className="flex items-center gap-2">
            {cmdCounts.failed > 0 ? <Badge variant="danger" size="sm">Ошибок: {cmdCounts.failed}</Badge> : null}
            {cmdCounts.processing > 0 ? <Badge variant="warning" size="sm">В работе: {cmdCounts.processing}</Badge> : null}
            {cmdCounts.pending > 0 ? <Badge variant="neutral" size="sm">В очереди: {cmdCounts.pending}</Badge> : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchAgentCommands}
              isLoading={commandsLoading}
              icon={<RefreshCw size={14} className={hasInFlightCommands ? 'animate-spin' : ''} />}
            >
              Обновить
            </Button>
            {agentCommands.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setClearConfirmOpen(true)}
                isLoading={clearingOld}
                icon={<Trash2 size={14} />}
                title="Удалить завершенные и ошибочные команды старше 7 дней"
              >
                Очистить старые
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-white/10">
              <tr>
                <th className="px-4 py-3 w-[130px]">Статус</th>
                <th className="px-4 py-3">Команда</th>
                <th className="px-4 py-3 w-[160px]">Создана</th>
                <th className="px-4 py-3 w-[160px]">Завершена</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {agentCommands.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    Команд пока нет. Запустите публикацию/массовую операцию — она появится здесь.
                  </td>
                </tr>
              ) : (
                agentCommands.slice(0, 30).map(c => {
                  const created = c.createdAtUtc ? new Date(c.createdAtUtc) : null;
                  const done = c.processedAtUtc ? new Date(c.processedAtUtc) : null;
                  const eta = etaFor(c);
                  const p = typeof c.progressPercent === 'number' ? Math.max(0, Math.min(100, c.progressPercent)) : null;
                  return (
                    <tr key={c.id} className={c.status === 'Failed' ? 'bg-rose-500/5' : 'hover:bg-white/5 transition-colors'}>
                      <td className="px-4 py-2">{commandBadge(c.status)}</td>
                      <td className="px-4 py-2">
                        <div className="text-slate-100 font-semibold">{c.commandType}</div>
                        {p != null ? (
                          <div className="mt-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>{p}%</span>
                              <span className="truncate max-w-[520px]">{c.progressMessage || ''}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500/70"
                                style={{ width: `${p}%` }}
                              />
                            </div>
                          </div>
                        ) : (c.progressMessage ? (
                          <div className="text-xs text-slate-400 mt-0.5">{c.progressMessage}</div>
                        ) : null)}
                        {c.errorMessage ? <div className="text-xs text-rose-200 mt-0.5 break-all">{c.errorMessage}</div> : null}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" title={c.id}>{c.id}</div>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400 font-mono whitespace-nowrap">{created ? formatRelativeShort(created) : '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {done ? formatRelativeShort(done) : (eta ? `ETA ${eta}` : '—')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/10 text-xs text-slate-500 flex items-center justify-between">
          <span>Автообновление: {hasInFlightCommands ? 'каждые 5с' : 'каждые 15с'}</span>
          <span>{commandsLastUpdate.getTime() > 0 ? `Обновлено: ${formatRelativeShort(commandsLastUpdate)}` : ''}</span>
        </div>
      </div>

      {route === 'mass-update' ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-50">Массовая смена платформы (публикации)</div>
              <div className="text-xs text-slate-400 mt-1">
                Это отдельный экран (deep‑link). Статус и прогресс операции отслеживайте в “Очереди агента” выше.
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onRouteChange('list')} title="Вернуться к списку публикаций">
              Назад к публикациям
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">Исходная версия (откуда)</label>
              <Select
                value={massSource}
                onChange={e => setMassSource(e.target.value)}
                options={[{ value: '', label: 'Все (любая версия)' }, ...versions.map(v => ({ value: v, label: v }))]}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">Целевая версия (куда)</label>
              <Select
                value={massTarget}
                onChange={e => setMassTarget(e.target.value)}
                options={[{ value: '', label: '--' }, ...versions.map(v => ({ value: v, label: v }))]}
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
              <div className="font-semibold text-slate-50">Предпросмотр</div>
              <div className="mt-1 text-slate-300">
                Будет затронуто публикаций: <b className="text-slate-50">{affectedPublicationsCount}</b>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Фильтр “исходная версия” ограничивает список, иначе меняются все публикации.
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => onRouteChange('list')}>Отмена</Button>
              <Button onClick={() => setMassConfirmOpen(true)} disabled={!massTarget}>Запустить</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="text-sm font-semibold text-slate-50">Web‑публикации (обнаружено агентом)</div>
            <div className="text-xs text-slate-400 mt-1">
              Для редактирования откройте “Публикация” или используйте массовую смену платформы. Фильтры применяются только к этой таблице.
            </div>
          </div>
          <div className="p-4 border-b border-white/10 bg-slate-950/40">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Поиск по URL/пути/версии..."
                  className="!bg-white/5 !border-white/10 !text-slate-100"
                  fullWidth
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Select
                  fullWidth={false}
                  value={versionFilter}
                  onChange={(e) => onVersionFilterChange(e.target.value)}
                  options={[
                    { value: '', label: 'Любая версия' },
                    ...versions.map(v => ({ value: v, label: v }))
                  ]}
                />
                <Select
                  fullWidth={false}
                  value={siteFilter}
                  onChange={(e) => onSiteFilterChange(e.target.value)}
                  options={[
                    { value: '', label: 'Любой IIS‑сайт' },
                    ...pubSites.map(s => ({ value: s, label: s }))
                  ]}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onSearchChange('');
                    onVersionFilterChange('');
                    onSiteFilterChange('');
                  }}
                  disabled={!search && !versionFilter && !siteFilter}
                  title="Сбросить фильтры публикаций"
                >
                  Сбросить
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Найдено публикаций: <b className="text-slate-200">{filteredPublications.length}</b>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">Сайт</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Путь</th>
                  <th className="px-4 py-3">Версия</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredPublications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Ничего не найдено. Сбросьте фильтры или проверьте агента/настройки.
                    </td>
                  </tr>
                ) : (
                  filteredPublications.map(p => {
                    const base = p.appPath.replace(/^\//, '') || p.siteName || p.id;
                    return (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-slate-300 text-xs">{p.siteName || '—'}</td>
                        <td className="px-4 py-3 text-slate-100 font-mono text-xs">{p.appPath || '—'}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono text-xs truncate max-w-[520px]" title={p.physicalPath}>{p.physicalPath || '—'}</td>
                        <td className="px-4 py-3 text-slate-200">{p.version || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <ActionMenu
                            ariaLabel="Действия с публикацией"
                            items={[{ id: `edit:${p.id}`, label: 'Настройки', onClick: () => onEditPublication(base, p) }]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={massConfirmOpen}
        onClose={() => setMassConfirmOpen(false)}
        title="Запустить массовую смену платформы?"
        description={
          <>
            <div>Исходная версия: <b className="text-slate-50">{massSource || 'Любая'}</b></div>
            <div>Целевая версия: <b className="text-slate-50">{massTarget || '--'}</b></div>
            <div>Публикаций к изменению: <b className="text-slate-50">{affectedPublicationsCount}</b></div>
            <div className="text-xs text-slate-400">Операция выполняется агентом и может занять время.</div>
          </>
        }
        confirmText="Запустить"
        cancelText="Отмена"
        variant="danger"
        onConfirm={executeMassUpdate}
      />

      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Очистить старые записи?"
        description={
          <>
            <div className="text-sm text-slate-300 mb-2">
              Будет удалено завершенных и ошибочных команд старше <b className="text-slate-50">7 дней</b>.
            </div>
            <div className="text-xs text-slate-400">
              Команды в статусе "В очереди" и "В работе" не будут удалены.
            </div>
          </>
        }
        confirmText="Очистить"
        cancelText="Отмена"
        variant="danger"
        onConfirm={() => clearOldCommands(7)}
      />
    </div>
  );
};
