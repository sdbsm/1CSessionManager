import React from 'react';
import { ServerInfo } from '../hooks/useServerInfo';

interface HeaderProps {
  serverInfo: ServerInfo | null;
}

export const Header: React.FC<HeaderProps> = ({ 
  serverInfo, 
}) => {
  return (
    <header className="bg-slate-950/60 backdrop-blur supports-[backdrop-filter]:bg-slate-950/40 h-16 border-b border-white/10 flex items-center px-6 justify-between sticky top-0 z-10">
      <div className="flex items-center gap-6 min-w-0">
        <h2 className="text-sm font-medium text-slate-300 truncate">
          Сервер: <span className="text-slate-50 font-semibold">
          {serverInfo?.hostname || 'Загрузка...'}
          </span> {serverInfo?.osVersion && <span className="text-slate-400">{`(${serverInfo.osVersion})`}</span>}
        </h2>
      </div>

      <div className="flex items-center gap-4">
         <div className="text-right">
            <div className="text-sm font-semibold text-slate-50">Administrator</div>
            <div className="text-xs text-slate-400">System Admin</div>
         </div>
         <div className="w-10 h-10 bg-indigo-500/15 rounded-full flex items-center justify-center text-indigo-200 font-semibold ring-1 ring-indigo-500/30">
            A
         </div>
      </div>
    </header>
  );
};
