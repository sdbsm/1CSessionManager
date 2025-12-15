import React from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Database, 
  FileText, 
  Pencil, 
  Trash2, 
  XCircle 
} from 'lucide-react';
import { Client } from '../../types';
import { Badge } from '../../components/ui/Badge';

interface ClientRowProps {
  client: Client;
  isExpanded: boolean;
  onToggleExpand: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRemoveDatabase: (clientId: string, dbName: string) => void;
}

export const ClientRow: React.FC<ClientRowProps> = ({
  client,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onRemoveDatabase
}) => {
  const isUnlimited = client.maxSessions === 0;
  const percentage = !isUnlimited 
    ? Math.round((client.activeSessions / client.maxSessions) * 100) 
    : 0;
  const isCritical = !isUnlimited && percentage >= 100;
  const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;

  const previewDbs = client.databases.slice(0, 2);
  const remainingDbs = client.databases.length - previewDbs.length;

  return (
    <React.Fragment>
      <tr className={`group transition-colors ${isExpanded ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}>
        <td className="px-6 py-4">
          <button
            onClick={onToggleExpand}
            className="text-slate-500 hover:text-indigo-300 transition-colors"
          >
            {isExpanded ? <ChevronUp size={18} className="text-indigo-300" /> : <ChevronDown size={18} />}
          </button>
        </td>
        <td className="px-6 py-4">
          <div className="font-semibold text-slate-50">{client.name}</div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {previewDbs.length > 0 ? (
              <>
                {previewDbs.map((db, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-200 ring-1 ring-indigo-500/20">
                    <Database size={12} />
                    <span className="truncate max-w-[120px]">{db.name}</span>
                    {db.activeSessions > 0 && (
                      <span className="text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500">
                        {db.activeSessions}
                      </span>
                    )}
                  </span>
                ))}
                {remainingDbs > 0 && (
                  <button
                    onClick={onToggleExpand}
                    className="text-xs text-indigo-300 hover:text-indigo-200 font-medium"
                  >
                    +{remainingDbs} еще
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-500 italic">Нет баз данных</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <div className="w-full max-w-[180px]">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-slate-200">
                {client.activeSessions} / {isUnlimited ? '∞' : client.maxSessions}
              </span>
              {!isUnlimited && (
                <span className={`font-bold ${isCritical ? 'text-rose-300' : isWarning ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {percentage}%
                </span>
              )}
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden bg-white/10">
              {isUnlimited ? (
                <div className="h-full w-full bg-gradient-to-r from-indigo-500/30 to-indigo-500/70" />
              ) : (
                <div 
                  className={`h-full rounded-full transition-all ${
                    isCritical ? 'bg-rose-500' : 
                    isWarning ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <Badge variant={client.status === 'active' ? 'success' : client.status === 'blocked' ? 'danger' : 'warning'}>
             {client.status === 'active' ? 'Активен' : client.status === 'blocked' ? 'Блокировка' : 'Внимание'}
          </Badge>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.hash = `#/events?clientId=${encodeURIComponent(client.id)}`;
              }}
              className="text-slate-300 hover:text-white p-2 hover:bg-white/5 rounded-md transition-colors"
              title="Открыть события по клиенту"
            >
              <FileText size={16} />
            </button>
            <button 
              onClick={onEdit}
              className="text-indigo-300 hover:text-indigo-200 p-2 hover:bg-indigo-500/10 rounded-md transition-colors" 
              title="Редактировать"
            >
              <Pencil size={16} />
            </button>
            <button 
              onClick={onDelete}
              className="text-rose-300 hover:text-rose-200 p-2 hover:bg-rose-500/10 rounded-md transition-colors"
              title="Удалить"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
      
      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-indigo-500/5 border-b border-white/10">
          <td colSpan={6} className="px-6 py-6">
            <div className="ml-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Database size={16} />
                Все базы данных ({client.databases.length})
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.hash = `#/events?clientId=${encodeURIComponent(client.id)}`;
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors flex items-center gap-2"
                  title="Открыть события по клиенту"
                >
                  <FileText size={14} />
                  События
                </button>
              </div>
              {client.databases.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {client.databases.map((db, idx) => (
                    <div key={idx} className="p-4 rounded-lg border shadow-sm hover:shadow-panel transition-shadow bg-slate-950/40 border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate text-slate-50" title={db.name}>
                            {db.name}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                             e.stopPropagation();
                             onRemoveDatabase(client.id, db.name);
                          }}
                          className="ml-2 flex-shrink-0 text-rose-300 hover:text-rose-200"
                          title="Удалить базу"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                        <span className="text-xs uppercase font-semibold text-slate-400">Активных сеансов</span>
                        <span className={`text-lg font-bold ${db.activeSessions > 0 ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {db.activeSessions}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm italic text-slate-500">Базы данных не привязаны.</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};
