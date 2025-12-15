import React, { useMemo, useState } from 'react';
import { Search, Loader2, Check, X, Database, Plus } from 'lucide-react';
import { Client } from '../../types';
import { useInfobases } from '../../hooks/useInfobases';
import { useToast } from '../../hooks/useToast';

interface DatabaseSelectionProps {
  selectedDbNames: string[];
  setSelectedDbNames: (value: string[]) => void;
  clients: Client[];
  editingClient: Client | null;
}

export const DatabaseSelection: React.FC<DatabaseSelectionProps> = ({
  selectedDbNames,
  setSelectedDbNames,
  clients,
  editingClient
}) => {
  const { availableDbs, loading, fetchDatabases } = useInfobases();
  const toast = useToast();
  const [dbSearch, setDbSearch] = useState('');
  const [manualAdd, setManualAdd] = useState('');

  const normalizedSelected = useMemo(() => {
    return new Set(selectedDbNames.map(s => s.trim()).filter(Boolean));
  }, [selectedDbNames]);

  const toggleDatabaseSelection = (dbName: string) => {
    const assignedToOtherClient = clients.find(c => {
      if (editingClient && c.id === editingClient.id) return false;
      return c.databases.some(d => d.name === dbName);
    });
    
    if (assignedToOtherClient) {
      toast.error({
        title: 'Конфликт привязки',
        message: `База «${dbName}» уже привязана к клиенту «${assignedToOtherClient.name}».\nКаждая база может быть привязана только к одному клиенту.`
      });
      return;
    }
    
    const currentList = selectedDbNames.map(s => s.trim()).filter(Boolean);
    const exists = currentList.includes(dbName);
    
    let newList;
    if (exists) {
      newList = currentList.filter(d => d !== dbName);
    } else {
      newList = [...currentList, dbName];
    }
    
    setSelectedDbNames(newList);
  };

  const filteredAvailableDbs = useMemo(() => {
    const q = dbSearch.trim().toLowerCase();
    return q ? availableDbs.filter(db => db.name.toLowerCase().includes(q)) : availableDbs;
  }, [availableDbs, dbSearch]);

  const handleManualAdd = () => {
    const raw = (manualAdd || '').trim();
    if (!raw) return;

    const tokens = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (tokens.length === 0) return;

    const availableByLower = new Map<string, string>();
    for (const db of availableDbs) availableByLower.set(db.name.toLowerCase(), db.name);

    const next = new Set(selectedDbNames.map(s => s.trim()).filter(Boolean));
    const notFound: string[] = [];
    const skippedAssigned: string[] = [];

    for (const t of tokens) {
      const canonical = availableByLower.get(t.toLowerCase());
      if (!canonical) {
        notFound.push(t);
        continue;
      }

      const assignedToOtherClient = clients.find(c => {
        if (editingClient && c.id === editingClient.id) return false;
        return c.databases.some(d => d.name === canonical);
      });

      if (assignedToOtherClient) {
        skippedAssigned.push(canonical);
        continue;
      }

      next.add(canonical);
    }

    setSelectedDbNames(Array.from(next));
    setManualAdd('');

    if (notFound.length > 0) {
      toast.warning({
        title: 'Часть инфобаз не найдена',
        message: `Проверьте названия: ${notFound.slice(0, 10).join(', ')}${notFound.length > 10 ? '…' : ''}`
      });
    }

    if (skippedAssigned.length > 0) {
      toast.error({
        title: 'Конфликт привязки',
        message: `Эти инфобазы уже привязаны к другим клиентам: ${skippedAssigned.slice(0, 10).join(', ')}${skippedAssigned.length > 10 ? '…' : ''}`
      });
    }
  };

  return (
    <div className="rounded-lg border p-4 bg-white/5 border-white/10">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input 
          type="text" 
          value={dbSearch}
          onChange={(e) => setDbSearch(e.target.value)}
          placeholder="Поиск инфобаз..." 
          className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-indigo-500 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <div className="h-64 overflow-y-auto custom-scrollbar space-y-1 border rounded-md p-2 bg-slate-950/40 border-white/10">
        {loading ? (
          <div className="flex justify-center items-center h-full text-xs text-slate-400">
            <Loader2 className="animate-spin mr-2" size={16} />
            Загрузка списка баз с сервера 1С...
          </div>
        ) : filteredAvailableDbs.length > 0 ? (
          filteredAvailableDbs.map(db => {
            const isSelected = normalizedSelected.has(db.name);
            const assignedToClient = clients.find(c => {
              if (editingClient && c.id === editingClient.id) return false;
              return c.databases.some(d => d.name === db.name);
            });
            const isAssigned = !!assignedToClient;
            
            return (
              <div 
                key={db.uuid} 
                onClick={() => !isAssigned && toggleDatabaseSelection(db.name)}
                className={`flex items-center p-2 rounded-md transition-colors text-sm ${
                  isSelected 
                    ? 'bg-indigo-500/10 text-indigo-100 border-indigo-500/20 border' 
                    : isAssigned
                    ? 'bg-rose-500/10 text-rose-200 border-rose-500/20 border cursor-not-allowed'
                    : 'text-slate-200 hover:bg-white/5 cursor-pointer'
                }`}
                title={isAssigned ? `База уже привязана к клиенту "${assignedToClient?.name}"` : ''}
              >
                <div className={`w-4 h-4 mr-3 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected 
                    ? 'bg-indigo-500 border-indigo-500' 
                    : isAssigned
                    ? 'border-rose-500/30 bg-rose-500/10'
                    : 'border-white/10 bg-white/5'
                }`}>
                  {isSelected && <Check size={10} className="text-white" />}
                  {isAssigned && !isSelected && <X size={10} className="text-rose-500" />}
                </div>
                <span className="flex-1 truncate">{db.name}</span>
                {isAssigned && assignedToClient && (
                  <span className="text-xs ml-2 font-medium flex-shrink-0 text-rose-200">
                    → {assignedToClient.name}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-xs p-4 text-center text-slate-500">
            <Database size={24} className="mb-2 opacity-20" />
            {availableDbs.length === 0 ? 'Нет соединения с 1С или список пуст.' : 'Базы не найдены.'}
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            Выбрано инфобаз: <b className="text-slate-200">{selectedDbNames.map(s => s.trim()).filter(Boolean).length}</b>
          </div>
          <button
            type="button"
            onClick={() => fetchDatabases()}
            className="text-xs px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
            title="Обновить список инфобаз"
          >
            Обновить список
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={manualAdd}
            onChange={(e) => setManualAdd(e.target.value)}
            placeholder="Добавить вручную: Base1, Base2..."
            className="flex-1 px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 font-mono bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleManualAdd}
            disabled={!manualAdd.trim()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Добавить инфобазы"
          >
            <Plus size={14} />
            Добавить
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedDbNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleDatabaseSelection(name)}
              className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              title="Убрать из выбранных"
            >
              <Database size={12} className="text-slate-400" />
              <span className="max-w-[220px] truncate">{name}</span>
              <X size={12} className="text-slate-500" />
            </button>
          ))}
          {selectedDbNames.length === 0 ? (
            <div className="text-xs text-slate-500">Ничего не выбрано.</div>
          ) : null}
        </div>

        {loading ? <div className="text-xs text-slate-500">Загрузка списка инфобаз…</div> : null}
      </div>
    </div>
  );
};
