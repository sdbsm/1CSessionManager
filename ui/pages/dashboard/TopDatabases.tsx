import React from 'react';
import { Database, Users } from 'lucide-react';
import { DatabaseInfo } from '../../hooks/useDashboardData';

interface TopDatabasesProps {
  databases: DatabaseInfo[];
}

export const TopDatabases: React.FC<TopDatabasesProps> = ({ databases }) => {
  if (!databases || databases.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 h-full">
        <h3 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-500" />
          Крупнейшие базы данных
        </h3>
        <div className="text-slate-500 text-sm text-center py-8">
          Нет данных о размере баз (проверьте подключение к SQL)
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 h-full flex flex-col">
      <h3 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-blue-500" />
        Крупнейшие базы данных
      </h3>
      
      <div className="flex-1 overflow-auto">
        <div className="space-y-3">
          {databases.map((db) => (
            <div key={db.name} className="flex items-center justify-between p-3 rounded-md bg-slate-800/50 border border-slate-800">
              <div className="flex flex-col min-w-0 flex-1 mr-4">
                <span className="text-sm font-medium text-slate-200 truncate" title={db.name}>
                  {db.name}
                </span>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {db.sessions}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-semibold text-blue-200">
                  {db.sizeMB >= 1024 
                    ? `${(db.sizeMB / 1024).toFixed(2)} GB` 
                    : `${Math.round(db.sizeMB)} MB`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
