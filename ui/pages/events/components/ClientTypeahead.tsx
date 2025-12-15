import React, { useEffect, useMemo, useState } from 'react';
import { Client } from '../../../types';

interface ClientTypeaheadProps {
  clients: Client[];
  valueClientId: string;
  onChangeClientId: (clientId: string) => void;
}

export const ClientTypeahead: React.FC<ClientTypeaheadProps> = ({
  clients,
  valueClientId,
  onChangeClientId
}) => {
  const byId = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const [text, setText] = useState('');

  useEffect(() => {
    const current = valueClientId ? byId.get(valueClientId)?.name || '' : '';
    setText(current);
  }, [valueClientId, byId]);

  const idByNameLower = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) map.set(c.name.toLowerCase(), c.id);
    return map;
  }, [clients]);

  const tryCommit = (nextText: string) => {
    const t = nextText.trim();
    if (!t) {
      onChangeClientId('');
      return;
    }
    const id = idByNameLower.get(t.toLowerCase());
    if (id) onChangeClientId(id);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">Клиент:</span>
      <input
        list="clients-datalist"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => tryCommit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            tryCommit(text);
          }
          if (e.key === 'Escape') {
            // reset to current selection
            const current = valueClientId ? byId.get(valueClientId)?.name || '' : '';
            setText(current);
          }
        }}
        placeholder="начните вводить..."
        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-[220px] placeholder:text-slate-500"
        title="Введите имя клиента и выберите из подсказки (Enter — применить)"
      />
      <datalist id="clients-datalist">
        {clients.map(c => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      {valueClientId && (
        <button
          type="button"
          onClick={() => onChangeClientId('')}
          className="text-xs text-indigo-300 hover:text-indigo-200"
          title="Сбросить фильтр клиента"
        >
          Сбросить
        </button>
      )}
    </div>
  );
};


