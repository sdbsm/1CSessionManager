import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Client } from '../types';
import { useNavHistory } from '../hooks/useNavHistory';

type Crumb = { label: string; hash?: string };

function parseHash(hash: string) {
  const raw = (hash || '').replace(/^#/, '');
  const path = raw.startsWith('/') ? raw.slice(1) : raw;
  const [routePath, qs] = path.split('?');
  const segs = (routePath || '').split('/').map(s => s.trim()).filter(Boolean);
  const baseRoute = segs[0] || '';
  const subRoute = segs[1] || '';
  const subSubRoute = segs[2] || '';
  const params = new URLSearchParams(qs || '');
  return { baseRoute, subRoute, subSubRoute, params };
}

export const Breadcrumbs: React.FC<{ clients: Client[] }> = ({ clients }) => {
  const [hash, setHash] = useState(() => window.location.hash || '#/status');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/status');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { baseRoute, subRoute, subSubRoute, params } = useMemo(() => parseHash(hash), [hash]);
  const nav = useNavHistory();

  const crumbs = useMemo<Crumb[]>(() => {
    const list: Crumb[] = [];

    if (baseRoute === 'status' || baseRoute === '') {
      list.push({ label: 'Обзор', hash: '#/status' });
      return list;
    }

    if (baseRoute === 'clients') {
      list.push({ label: 'Клиенты', hash: '#/clients' });
      const view = subRoute || params.get('view') || '';
      if (view === 'infobases') list.push({ label: 'Инфобазы', hash: '#/clients/infobases' });
      else if (view === 'publications') {
        list.push({ label: 'Публикации', hash: '#/clients/publications' });
        if (subSubRoute === 'mass-update') list.push({ label: 'Массовая смена платформы' });
      }
      const clientId = params.get('clientId');
      if (clientId) {
        const name = clients.find(c => c.id === clientId)?.name || clientId;
        list.push({ label: name });
      }
      return list;
    }

    if (baseRoute === 'events') {
      list.push({ label: 'События', hash: '#/events' });
      const clientId = params.get('clientId');
      const db = params.get('database');
      const view = params.get('view');
      if (view === 'groups') list.push({ label: 'Группы' });
      if (clientId) {
        const name = clients.find(c => c.id === clientId)?.name || clientId;
        list.push({ label: name });
      } else if (db) {
        list.push({ label: db });
      }
      return list;
    }

    if (baseRoute === 'settings') {
      list.push({ label: 'Настройки', hash: '#/settings' });
      return list;
    }

    // fallback
    list.push({ label: 'Раздел', hash: `#/${baseRoute}` });
    return list;
  }, [baseRoute, subRoute, subSubRoute, params, clients]);

  const returnHash = useMemo(() => {
    const ret = params.get('return');
    if (!ret) return null;
    try {
      return decodeURIComponent(ret);
    } catch {
      return ret;
    }
  }, [params]);

  return (
    <nav className="h-10 flex items-center px-6 border-b border-white/10 bg-slate-950/40 backdrop-blur supports-[backdrop-filter]:bg-slate-950/30 sticky top-16 z-10">
      <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0 w-full">
        {(returnHash || nav.canGoBack) ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors mr-1"
            onClick={() => {
              if (returnHash) window.location.hash = returnHash;
              else nav.goBack();
            }}
            title="Назад"
          >
            <ArrowLeft size={14} />
            Назад
          </button>
        ) : null}
        {crumbs.map((c, idx) => (
          <React.Fragment key={`${c.label}-${idx}`}>
            {idx > 0 && <ChevronRight size={14} className="text-slate-600" />}
            {c.hash ? (
              <button
                type="button"
                className="hover:text-slate-200 transition-colors truncate"
                onClick={() => { window.location.hash = c.hash!; }}
                title={c.label}
              >
                {c.label}
              </button>
            ) : (
              <span className="text-slate-200 font-semibold truncate" title={c.label}>
                {c.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
};


