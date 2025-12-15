import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, Users, Database, FileText, X, Link2, Trash2, Save } from 'lucide-react';
import { Client, SystemEvent } from '../../types';
import { useToast } from '../../hooks/useToast';
import { TimeRange } from '../../hooks/useTimeRange';
import { apiFetchJson } from '../../services/apiClient';
import { useSavedLinks } from '../../hooks/useSavedLinks';

type CommandItem =
  | { id: string; kind: 'client'; label: string; hint?: string; run: () => void }
  | { id: string; kind: 'infobase'; label: string; hint?: string; run: () => void }
  | { id: string; kind: 'event'; label: string; hint?: string; run: () => void }
  | { id: string; kind: 'action'; label: string; hint?: string; run: () => void };

interface CommandPaletteProps {
  clients: Client[];
  timeRange: TimeRange;
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ clients, timeRange, isOpen, onClose }) => {
  const toast = useToast();
  const saved = useSavedLinks();
  const [q, setQ] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQ('');
    setSaveOpen(false);
    setManageOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setEventsLoading(true);
    (async () => {
      try {
        const toBuffered = new Date(timeRange.toUtc.getTime() + 5 * 60_000);
        const res = await apiFetchJson<SystemEvent[]>(
          `/api/events?fromUtc=${encodeURIComponent(timeRange.fromUtc.toISOString())}&toUtc=${encodeURIComponent(toBuffered.toISOString())}&levels=critical,warning&take=200`
        );
        if (!alive) return;
        setEvents(res);
      } catch (e) {
        if (!alive) return;
        // Silent fail: palette should still be useful for clients/infobases/actions
        setEvents([]);
      } finally {
        if (alive) setEventsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, timeRange.fromUtc, timeRange.toUtc]);

  const items = useMemo<CommandItem[]>(() => {
    const query = q.trim().toLowerCase();

    const baseActions: CommandItem[] = [
      {
        id: 'saved:save-current',
        kind: 'action',
        label: 'Сохранить ссылку: текущая страница',
        hint: 'Добавит быстрый переход в Command Palette',
        run: () => {
          setManageOpen(false);
          setSaveOpen(true);
          setDraftName('');
        }
      },
      {
        id: 'saved:manage',
        kind: 'action',
        label: 'Управление: сохранённые ссылки',
        hint: 'Открыть список и удалить лишнее',
        run: () => {
          setSaveOpen(false);
          setManageOpen(v => !v);
        }
      },
      {
        id: 'go:clients',
        kind: 'action',
        label: 'Открыть: Клиенты',
        hint: 'Переход в раздел клиентов',
        run: () => { window.location.hash = '#/clients'; }
      },
      {
        id: 'go:events',
        kind: 'action',
        label: 'Открыть: События',
        hint: 'Переход в журнал событий',
        run: () => { window.location.hash = '#/events'; }
      },
      {
        id: 'go:infobases',
        kind: 'action',
        label: 'Открыть: Нераспределённые базы',
        hint: 'Управление базами без владельцев',
        run: () => { window.location.hash = '#/clients/infobases'; }
      },
      {
        id: 'go:mass-update',
        kind: 'action',
        label: 'Открыть: Массовая смена платформы',
        hint: 'Обновление версий публикаций',
        run: () => { window.location.hash = '#/clients/publications/mass-update'; }
      },
      {
        id: 'copy:events-critical',
        kind: 'action',
        label: 'Скопировать ссылку: События (critical)',
        hint: 'Удобно для шаринга/тикетов',
        run: async () => {
          const link = '#/events?levels=critical';
          try {
            await navigator.clipboard.writeText(link);
            toast.success({ title: 'Ссылка скопирована', message: link });
          } catch {
            toast.error({ title: 'Не удалось скопировать', message: link });
          }
        }
      }
    ];

    const savedLinks: CommandItem[] = saved.links.map(l => ({
      id: `saved:${l.id}`,
      kind: 'action',
      label: `★ ${l.name}`,
      hint: l.hash,
      run: () => { window.location.hash = l.hash; }
    }));

    const clientItems: CommandItem[] = clients.map(c => ({
      id: `client:${c.id}`,
      kind: 'client',
      label: c.name,
      hint: `Открыть детали клиента • инфобаз: ${c.databases.length}`,
      run: () => { window.location.hash = `#/clients?clientId=${encodeURIComponent(c.id)}`; }
    }));

    const infobaseItems: CommandItem[] = clients.flatMap(c => c.databases.map(db => ({
      id: `db:${c.id}:${db.name}`,
      kind: 'infobase',
      label: db.name,
      hint: `Клиент: ${c.name}`,
      run: () => { window.location.hash = `#/clients?clientId=${encodeURIComponent(c.id)}`; }
    })));

    const eventItems: CommandItem[] = (query.length >= 2)
      ? events.map(ev => {
          const time = (ev.timestampLocal || ev.timestampUtc || ev.timestamp || '').toString();
          const hintParts = [
            time,
            ev.clientName ? `Клиент: ${ev.clientName}` : null,
            ev.databaseName ? `Инфобаза: ${ev.databaseName}` : null,
          ].filter(Boolean);
          return {
            id: `event:${ev.id}`,
            kind: 'event',
            label: ev.message,
            hint: hintParts.join(' • '),
            run: () => {
              const qp = new URLSearchParams();
              qp.set('levels', 'critical,warning');
              if (ev.clientId) qp.set('clientId', ev.clientId);
              if (ev.databaseName) qp.set('database', ev.databaseName);
              const snippet = ev.message.trim().slice(0, 80);
              if (snippet) qp.set('q', snippet);
              const ret = window.location.hash || '#/status';
              qp.set('return', ret);
              window.location.hash = `#/events?${qp.toString()}`;
            }
          };
        })
      : [];

    const all = [...savedLinks, ...baseActions, ...clientItems, ...infobaseItems, ...eventItems];
    if (!query) return all.slice(0, 30);

    const scored = all
      .map(it => {
        const hay = `${it.label} ${it.hint || ''}`.toLowerCase();
        const score =
          hay.startsWith(query) ? 3 :
          hay.includes(query) ? 2 :
          0;
        return { it, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.label.localeCompare(b.it.label));

    return scored.map(x => x.it).slice(0, 30);
  }, [clients, events, q, saved.links, toast, timeRange.fromUtc, timeRange.toUtc]);

  const iconFor = (kind: CommandItem['kind']) => {
    if (kind === 'client') return <Users size={16} className="text-indigo-300" />;
    if (kind === 'infobase') return <Database size={16} className="text-slate-300" />;
    if (kind === 'event') return <FileText size={16} className="text-amber-200" />;
    return <FileText size={16} className="text-slate-300" />;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm p-4 flex items-start justify-center animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Глобальный поиск"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="text-slate-400">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: клиент, инфобаза, событие, команда..."
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <button
            type="button"
            className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {saveOpen ? (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Сохранить ссылку на текущую страницу: <span className="font-mono text-slate-200">{window.location.hash || '#/status'}</span>
              </div>
              <button
                type="button"
                className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setSaveOpen(false)}
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Название (например: Critical incidents)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                autoFocus
              />
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!draftName.trim()}
                onClick={() => {
                  const link = window.location.hash || '#/status';
                  const v = saved.addLink(draftName, link);
                  if (v) {
                    toast.success({ title: 'Сохранено', message: v.name });
                    setSaveOpen(false);
                    setDraftName('');
                    setQ('');
                  }
                }}
                title="Сохранить"
              >
                <Save size={16} />
                Сохранить
              </button>
            </div>
          </div>
        ) : null}

        {manageOpen ? (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Link2 size={16} className="text-slate-300" />
                Сохранённые ссылки
              </div>
              <button
                type="button"
                className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setManageOpen(false)}
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>
            {saved.links.length === 0 ? (
              <div className="mt-2 text-xs text-slate-400">Пока пусто. Используйте “Сохранить ссылку: текущая страница”.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {saved.links.slice(0, 12).map(l => (
                  <div key={l.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <button
                      type="button"
                      className="flex-1 text-left min-w-0"
                      onClick={() => { window.location.hash = l.hash; onClose(); }}
                      title="Открыть"
                    >
                      <div className="text-sm font-semibold text-slate-100 truncate">{l.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{l.hash}</div>
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-md text-slate-300 hover:text-rose-200 hover:bg-rose-500/10 transition-colors"
                      onClick={() => {
                        saved.deleteLink(l.id);
                        toast.info({ title: 'Удалено', message: l.name });
                      }}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {saved.links.length > 12 ? (
                  <div className="text-[10px] text-slate-500">Показаны первые 12 (всего: {saved.links.length}).</div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {eventsLoading ? (
          <div className="px-4 py-2 border-b border-white/10 text-xs text-slate-500">
            Загружаю события (warn+)…
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">Ничего не найдено.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {items.map(it => (
                <button
                  key={it.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3"
                  onClick={() => {
                    it.run();
                    onClose();
                  }}
                >
                  <div className="w-5 flex justify-center">{iconFor(it.kind)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">{it.label}</div>
                    {it.hint && <div className="text-xs text-slate-400 truncate">{it.hint}</div>}
                  </div>
                  <div className="text-slate-600">
                    <ArrowRight size={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 text-xs text-slate-500 flex items-center justify-between">
          <span>Enter: открыть • Esc: закрыть</span>
          <span>Ctrl+K: открыть поиск</span>
        </div>
      </div>
    </div>
  );
};


