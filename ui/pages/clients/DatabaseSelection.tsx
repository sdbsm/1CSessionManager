import React, { useState } from 'react';
import { Search, Loader2, Check, X, Database } from 'lucide-react';
import { Client } from '../../types';
import { useInfobases } from '../../hooks/useInfobases';

interface DatabaseSelectionProps {
  manualDbInput: string;
  setManualDbInput: (value: string) => void;
  clients: Client[];
  editingClient: Client | null;
}

export const DatabaseSelection: React.FC<DatabaseSelectionProps> = ({
  manualDbInput,
  setManualDbInput,
  clients,
  editingClient
}) => {
  const { availableDbs, loading, fetchDatabases } = useInfobases();
  const [dbSearch, setDbSearch] = useState('');

  const isDbSelectedInText = (dbName: string) => {
    const currentList = manualDbInput.split(/[\n,]+/).map(s => s.trim());
    return currentList.includes(dbName);
  };

  const toggleDatabaseSelection = (dbName: string) => {
    const assignedToOtherClient = clients.find(c => {
      if (editingClient && c.id === editingClient.id) return false;
      return c.databases.some(d => d.name === dbName);
    });
    
    if (assignedToOtherClient) {
      alert(`База данных "${dbName}" уже привязана к клиенту "${assignedToOtherClient.name}".\n\nКаждая база может быть привязана только к одному клиенту.`);
      return;
    }
    
    const currentList = manualDbInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    const exists = currentList.includes(dbName);
    
    let newList;
    if (exists) {
      newList = currentList.filter(d => d !== dbName);
    } else {
      newList = [...currentList, dbName];
    }
    
    setManualDbInput(newList.join(', '));
  };

  const filteredAvailableDbs = availableDbs.filter(db => 
    db.name.toLowerCase().includes(dbSearch.toLowerCase())
  );

  return (
    <div className="rounded-lg border p-4 bg-white/5 border-white/10">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input 
          type="text" 
          value={dbSearch}
          onChange={(e) => setDbSearch(e.target.value)}
          placeholder="Поиск баз данных..." 
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
            const isSelected = isDbSelectedInText(db.name);
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
      
      <div className="mt-3 pt-3 border-t border-white/10">
        <label className="block text-xs font-semibold mb-1 text-slate-200">
          Список баз данных (вручную):
        </label>
        <p className="text-xs mb-2 text-slate-500">
          Введите названия баз, разделяя их запятыми или с новой строки.
        </p>
        <textarea 
          value={manualDbInput}
          onChange={e => setManualDbInput(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 font-mono bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
          placeholder="Base1, Base2, Base3..."
          rows={3}
        />
      </div>
      
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>Найдено баз: <b className="text-slate-200">{manualDbInput.split(/[\n,]+/).filter(s=>s.trim()).length}</b></span>
        {loading && <span>Синхронизация...</span>}
      </div>
    </div>
  );
};
