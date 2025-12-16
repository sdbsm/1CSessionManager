import React, { useMemo } from 'react';
import { 
  FileText,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  Settings
} from 'lucide-react';
import { Client, AgentPublicationDto } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { UiDensity } from '../../hooks/useUiPrefs';

interface ClientRowProps {
  client: Client;
  onOpenDetails: (client: Client) => void;
  onOpenEvents: (clientId: string) => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  density: UiDensity;
  isExpanded?: boolean;
  publications?: AgentPublicationDto[];
  onRemoveDatabase?: (clientId: string, dbName: string) => void;
  onPublish?: (dbName: string) => void;
  onEditPublication?: (dbName: string, pub: AgentPublicationDto) => void;
}

export const ClientRow: React.FC<ClientRowProps> = ({
  client,
  onOpenDetails,
  onOpenEvents,
  onEdit,
  onDelete,
  density,
  isExpanded = false,
  publications = [],
  onRemoveDatabase,
  onPublish,
  onEditPublication
}) => {
  const cellPad = density === 'compact' ? 'px-6 py-2' : 'px-6 py-4';
  const isUnlimited = client.maxSessions === 0;
  const percentage = !isUnlimited 
    ? Math.round((client.activeSessions / client.maxSessions) * 100) 
    : 0;
  const isCritical = !isUnlimited && percentage >= 100;
  const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;

  const sessionBreakdown = client.databases
    .filter(db => db.activeSessions > 0)
    .map(db => `${db.name}: ${db.activeSessions}`)
    .join('\n');

  const previewDbs = client.databases.slice(0, 2);
  const remainingDbs = client.databases.length - previewDbs.length;
  const publishedCount = client.databases.filter(db => 
    publications.some(p => p.appPath.replace(/^\//, '').toLowerCase() === db.name.toLowerCase())
  ).length;

  const dbItems = useMemo(() => {
    if (!client) return [];
    return client.databases.map(db => {
      const pub = publications.find(p => p.appPath.replace(/^\//, '').toLowerCase() === db.name.toLowerCase());
      return { db, pub };
    });
  }, [client, publications]);

  return (
    <>
      <tr
        className={`group transition-colors cursor-pointer hover:bg-white/5 ${isExpanded ? 'bg-white/5 border-b-0' : ''}`}
        onClick={() => onOpenDetails(client)}
        title={isExpanded ? "Свернуть" : "Развернуть детали"}
      >
        <td className={`${cellPad} w-12`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(client);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className={cellPad}>
          <div className="font-semibold text-slate-50">{client.name}</div>
        </td>
          <td className={cellPad}>
          <div className="flex flex-col">
            <span className="text-sm text-slate-200 font-medium">
              {client.databases.length}
            </span>
            {publishedCount > 0 && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Globe size={10} />
                {publishedCount} опубл.
              </span>
            )}
          </div>
        </td>
          <td className={`${cellPad} align-middle`}>
            <div className="w-full max-w-[180px]" title={sessionBreakdown || 'Нет активных сеансов'}>
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
          <td className={`${cellPad} align-middle`}>
            <Badge variant={client.status === 'active' ? 'success' : client.status === 'blocked' ? 'danger' : 'warning'}>
               {client.status === 'active' ? 'Активен' : client.status === 'blocked' ? 'Блокировка' : 'Внимание'}
            </Badge>
          </td>
          <td className={`${cellPad} text-right`}>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEvents(client.id);
                }}
                className="text-slate-300 hover:text-white p-2 hover:bg-white/5 rounded-md transition-colors"
                title="Открыть события по клиенту"
              >
                <FileText size={16} />
              </button>
  
              <ActionMenu
                items={[
                  { id: 'edit', label: 'Редактировать', onClick: () => onEdit(client) },
                  { id: 'delete', label: 'Удалить', variant: 'danger', onClick: () => onDelete(client.id) }
                ]}
                ariaLabel="Действия с клиентом"
              />
            </div>
          </td>
      </tr>
      {isExpanded && (
        <tr className="bg-white/5 border-b border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
          <td colSpan={6} className="px-6 pb-6 pt-0">
            <div className="ml-12 pl-4 border-l-2 border-white/10">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Database size={16} />
                  Список инфобаз
                  <span className="text-xs text-slate-500 font-normal ml-2">Всего: {client.databases.length}</span>
                </div>
              </div>

              {dbItems.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-950/30 border border-white/5 text-sm text-slate-500 italic">
                  Инфобазы не привязаны.
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-slate-950/30 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950/50 text-slate-400 font-medium border-b border-white/10 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-2 font-medium">Имя базы</th>
                          <th className="px-4 py-2 font-medium w-24">Сеансы</th>
                          <th className="px-4 py-2 font-medium">Публикация</th>
                          <th className="px-4 py-2 text-right w-32">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dbItems.map(({ db, pub }) => (
                          <tr key={db.name} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2 font-medium text-slate-200">{db.name}</td>
                            <td className="px-4 py-2 text-slate-300">{db.activeSessions}</td>
                            <td className="px-4 py-2">
                              {pub ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                                    <Globe size={10} /> {pub.appPath}
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate max-w-[300px]" title={pub.physicalPath}>
                                    {pub.physicalPath}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 italic">Нет</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {pub ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onEditPublication?.(db.name, pub); }}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded"
                                    title="Настройки WEB-публикации"
                                  >
                                    <Settings size={14} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onPublish?.(db.name); }}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded"
                                    title="Опубликовать инфобазу (IIS)"
                                  >
                                    <Globe size={14} />
                                  </button>
                                )}
                                <ActionMenu
                                  align="end"
                                  items={[
                                    {
                                      id: 'unassign',
                                      label: 'Отвязать',
                                      variant: 'danger',
                                      onClick: () => onRemoveDatabase?.(client.id, db.name)
                                    }
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
