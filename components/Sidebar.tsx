import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings as SettingsIcon, 
  FileText, 
  LogOut,
  Database
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Дашбоард', icon: LayoutDashboard },
    { id: 'clients', label: 'Клиенты и Сеансы', icon: Users },
    { id: 'settings', label: 'Настройки', icon: SettingsIcon },
    { id: 'events', label: 'События', icon: FileText },
  ];

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col text-white flex-shrink-0">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-indigo-500 p-2 rounded-lg">
          <Database size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">1C Manager</h1>
          <p className="text-xs text-slate-400">Enterprise Edition</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
          <p className="text-xs text-slate-400 mb-1">Статус службы</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm font-medium text-green-400">Работает</span>
          </div>
        </div>
        <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          <LogOut size={18} />
          <span>Выход</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;