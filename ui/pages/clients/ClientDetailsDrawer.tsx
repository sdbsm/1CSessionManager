import React, { useMemo } from 'react';
import { Copy, Database, FileText, Globe, Settings } from 'lucide-react';
import { Client, AgentPublicationDto } from '../../types';
import { Drawer } from '../../components/ui/Drawer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { useToast } from '../../hooks/useToast';

interface ClientDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  publications: AgentPublicationDto[];
  onOpenEvents: (clientId: string) => void;
  onEditClient?: (client: Client) => void;
  onRemoveDatabase: (clientId: string, dbName: string) => void;
  onPublish: (dbName: string) => void;
  onEditPublication: (dbName: string, pub: AgentPublicationDto) => void;
}

export const ClientDetailsDrawer: React.FC<ClientDetailsDrawerProps> = ({
  isOpen,
  onClose,
  client,
  publications,
  onOpenEvents,
  onEditClient,
  onRemoveDatabase,
  onPublish,
  onEditPublication
}) => {
  const toast = useToast();
  const dbItems = useMemo(() => {
    if (!client) return [];
    return client.databases.map(db => {
      const pub = publications.find(p => p.appPath.replace(/^\//, '').toLowerCase() === db.name.toLowerCase());
      return { db, pub };
    });
  }, [client, publications]);


  if (!client) {
    if (!isOpen) return null;
    
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="Детали клиента" size="lg">
        <div className="space-y-4">
          <div className="text-sm text-slate-400">Клиент не найден или данные еще не загружены.</div>
          <div className="text-xs text-slate-500">
            Это может произойти, если клиент был удален или ID клиента не соответствует ни одному из существующих клиентов.
          </div>
        </div>
      </Drawer>
    );
  }

  const isUnlimited = client.maxSessions === 0;
  const percentage = !isUnlimited ? Math.round((client.activeSessions / client.maxSessions) * 100) : 0;
  const statusLabel = client.status === 'active' ? 'Активен' : client.status === 'blocked' ? 'Блокировка' : 'Внимание';

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Клиент: ${client.name}`} size="lg">
      <div className="space-y-5">
        {/* Summary */}
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-50 truncate">{client.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={client.status === 'active' ? 'success' : client.status === 'blocked' ? 'danger' : 'warning'}>
                  {statusLabel}
                </Badge>
                <span className="text-xs text-slate-400">
                  Сеансы: <b className="text-slate-100">{client.activeSessions}</b> / {isUnlimited ? '∞' : client.maxSessions}
                  {!isUnlimited ? <span className="text-slate-500">{` (${percentage}%)`}</span> : null}
                </span>
                <span className="text-xs text-slate-400">
                  Инфобаз: <b className="text-slate-100">{client.databases.length}</b>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenEvents(client.id)}
                icon={<FileText size={16} />}
                title="Открыть события по клиенту"
              >
                События
              </Button>
              {onEditClient && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEditClient(client)}
                  title="Редактировать клиента"
                >
                  Редактировать
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const link = `#/clients?clientId=${encodeURIComponent(client.id)}`;
                  try {
                    await navigator.clipboard.writeText(link);
                    toast.success({ title: 'Ссылка скопирована', message: link });
                  } catch {
                    toast.error({ title: 'Не удалось скопировать', message: link });
                  }
                }}
                icon={<Copy size={16} />}
                title="Скопировать ссылку на детали клиента"
              >
                Ссылка
              </Button>
            </div>
          </div>
        </div>

        {/* Databases */}
        <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <Database size={16} />
              Инфобазы
            </div>
            <div className="text-xs text-slate-400">Всего: {client.databases.length}</div>
          </div>

          {dbItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 italic">Инфобазы не привязаны.</div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dbItems.map(({ db, pub }) => (
                <div key={db.name} className="p-4 rounded-lg border border-white/10 bg-slate-950/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-50 truncate" title={db.name}>
                        {db.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Сеансов: <b className="text-slate-100">{db.activeSessions}</b>
                      </div>

                      {pub ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                            <Globe size={10} />
                            WEB опубликована
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate" title={pub.physicalPath}>
                            {pub.appPath} {pub.version ? `(v${pub.version})` : ''}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] text-slate-500 italic">Не опубликована</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {pub ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEditPublication(db.name, pub)}
                        icon={<Settings size={16} />}
                        title="Настройки WEB-публикации"
                      >
                        Публикация
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onPublish(db.name)}
                        icon={<Globe size={16} />}
                        title="Опубликовать инфобазу (IIS)"
                      >
                        Опубликовать
                      </Button>
                    )}

                    <ActionMenu
                      ariaLabel="Действия с инфобазой"
                      items={[
                        {
                          id: 'unassign',
                          label: 'Отвязать инфобазу',
                          variant: 'danger',
                          onClick: () => onRemoveDatabase(client.id, db.name)
                        }
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Совет: держите публикации и привязки инфобаз в порядке — это снижает шум в событиях и упрощает лимиты.
        </div>
      </div>
    </Drawer>
  );
};


