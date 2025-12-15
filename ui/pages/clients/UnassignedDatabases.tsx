import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';
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

  if (unassignedDatabases.length === 0) return null;

  return (
    <div className="rounded-xl shadow-sm overflow-hidden border border-amber-500/20 bg-amber-500/10">
      <div className="p-4 border-b border-amber-500/20 flex items-center justify-between bg-amber-500/10">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-200" />
          <h3 className="font-semibold text-slate-50">Нераспределенные базы данных</h3>
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
                  <select
                    className="flex-1 text-xs border border-white/10 bg-white/5 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40 text-slate-100"
                    onChange={(e) => {
                      if (e.target.value) {
                        onAssign(db.name, e.target.value);
                      }
                    }}
                    onBlur={() => setAssigningDb(null)}
                    autoFocus
                  >
                    <option value="" className="bg-slate-900">Выберите клиента...</option>
                    {clients
                      .filter(client => !client.databases.some(d => d.name === db.name))
                      .map(client => (
                        <option key={client.id} value={client.id} className="bg-slate-900">
                          {client.name}
                        </option>
                      ))}
                    {clients.filter(client => !client.databases.some(d => d.name === db.name)).length === 0 && (
                      <option value="" disabled className="bg-slate-900">Все клиенты уже имеют эту базу</option>
                    )}
                  </select>
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
