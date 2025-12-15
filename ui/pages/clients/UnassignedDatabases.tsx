import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, UserPlus, X, Search } from 'lucide-react';
import { Client } from '../../types';

interface UnassignedDatabasesProps {
  unassignedDatabases: { name: string; uuid: string }[];
  clients: Client[];
  onAssign: (dbName: string, clientId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const UnassignedDatabases: React.FC<UnassignedDatabasesProps> = ({
  unassignedDatabases,
  clients,
  onAssign,
  onRefresh,
  loading
}) => {
  const [assigningDb, setAssigningDb] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!assigningDb) return;
    setAssignQuery('');
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [assigningDb]);

  if (unassignedDatabases.length === 0) return null;

  return (
    <div className="rounded-xl shadow-sm overflow-hidden border border-amber-500/20 bg-amber-500/10">
      <div className="p-4 border-b border-amber-500/20 flex items-center justify-between bg-amber-500/10">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-200" />
          <h3 className="font-semibold text-slate-50">Нераспределенные инфобазы</h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-100 border border-amber-500/20">
            {unassignedDatabases.length}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="text-amber-200 hover:text-amber-100 p-1.5 hover:bg-amber-500/10 rounded-md transition-colors"
          title="Обновить список"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {unassignedDatabases.map((db) => (
            <div key={db.uuid} className="p-3 rounded-lg border border-white/10 bg-slate-950/40 shadow-sm hover:shadow-panel transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="truncate pr-2 flex-1" title={db.name}>
                  <span className="text-sm font-medium text-slate-100 block truncate">{db.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {assigningDb === db.name ? (
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          ref={searchRef}
                          value={assignQuery}
                          onChange={(e) => setAssignQuery(e.target.value)}
                          placeholder="Поиск клиента..."
                          className="w-full pl-7 pr-2 py-1.5 text-xs border border-white/10 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40 outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setAssigningDb(null);
                          }}
                          aria-label="Поиск клиента для присвоения"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssigningDb(null)}
                        className="p-1.5 rounded-md border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Отмена"
                        aria-label="Отмена присвоения"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <select
                      className="w-full text-xs border border-white/10 bg-white/5 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40 text-slate-100"
                      onChange={(e) => {
                        const clientId = e.target.value;
                        if (!clientId) return;
                        onAssign(db.name, clientId);
                        setAssigningDb(null);
                        setAssignQuery('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setAssigningDb(null);
                      }}
                      defaultValue=""
                      aria-label="Выбор клиента для присвоения инфобазы"
                    >
                      <option value="" className="bg-slate-900">Выберите клиента...</option>
                      {(() => {
                        const eligible = clients.filter(client => !client.databases.some(d => d.name === db.name));
                        const q = assignQuery.trim().toLowerCase();
                        const filtered = q ? eligible.filter(c => c.name.toLowerCase().includes(q)) : eligible;

                        if (eligible.length === 0) {
                          return (
                            <option value="" disabled className="bg-slate-900">
                              Все клиенты уже имеют эту базу
                            </option>
                          );
                        }

                        if (filtered.length === 0) {
                          return (
                            <option value="" disabled className="bg-slate-900">
                              Нет совпадений
                            </option>
                          );
                        }

                        return filtered.map(client => (
                          <option key={client.id} value={client.id} className="bg-slate-900">
                            {client.name}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssigningDb(db.name);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors"
                  >
                    <UserPlus size={12} />
                    Присвоить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
