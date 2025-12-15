import React from 'react';
import { 
  FileText
} from 'lucide-react';
import { Client } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { UiDensity } from '../../hooks/useUiPrefs';

interface ClientRowProps {
  client: Client;
  onOpenDetails: (client: Client) => void;
  onOpenEvents: (clientId: string) => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  density: UiDensity;
}

export const ClientRow: React.FC<ClientRowProps> = ({
  client,
  onOpenDetails,
  onOpenEvents,
  onEdit,
  onDelete,
  density
}) => {
  const cellPad = density === 'compact' ? 'px-6 py-2' : 'px-6 py-4';
  const isUnlimited = client.maxSessions === 0;
  const percentage = !isUnlimited 
    ? Math.round((client.activeSessions / client.maxSessions) * 100) 
    : 0;
  const isCritical = !isUnlimited && percentage >= 100;
  const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;

  const previewDbs = client.databases.slice(0, 2);
  const remainingDbs = client.databases.length - previewDbs.length;

  return (
    <tr
      className="group transition-colors cursor-pointer hover:bg-white/5"
      onClick={() => onOpenDetails(client)}
      title="Открыть детали клиента"
    >
      <td className={`${cellPad} w-12`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(client);
          }}
          className="text-xs px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
          title="Детали"
          aria-label="Открыть детали клиента"
        >
          Детали
        </button>
      </td>
      <td className={cellPad}>
        <div className="font-semibold text-slate-50">{client.name}</div>
      </td>
        <td className={cellPad}>
          <div className="flex items-center gap-2 flex-wrap">
            {previewDbs.length > 0 ? (
              <>
                {previewDbs.map((db, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-200 ring-1 ring-indigo-500/20">
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails(client);
                    }}
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
        <td className={`${cellPad} align-middle`}>
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
  );
};
