import React from 'react';
import { 
  Gauge, 
  Users, 
  Settings as SettingsIcon, 
  FileText, 
  LogOut,
  Database,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Client } from '../types';
import { TimeRange } from '../hooks/useTimeRange';
import { Badge } from './ui/Badge';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { useSidebarEventsSummary } from '../hooks/useSidebarEventsSummary';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  clients: Client[];
  timeRange: TimeRange;
  onOpenCommandPalette?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeRoute, onNavigate, clients, timeRange, onOpenCommandPalette }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const setup = useSetupStatus();
  const lastSeen = React.useMemo(() => {
    try {
      return localStorage.getItem('ui.events.lastSeenUtc');
    } catch {
      return null;
    }
  }, [activeRoute]);
  const eventsSummary = useSidebarEventsSummary(timeRange, lastSeen);

  const clientOverOrBlocked = React.useMemo(() => {
    return clients.filter(c => c.status === 'blocked' || (c.maxSessions > 0 && c.activeSessions >= c.maxSessions)).length;
  }, [clients]);

  const clientRisk = React.useMemo(() => {
    return clients.filter(c => c.maxSessions > 0 && c.activeSessions < c.maxSessions && (c.activeSessions / c.maxSessions) >= 0.8).length;
  }, [clients]);

  const setupMissing = React.useMemo(() => {
    let n = 0;
    if (setup.dbEndpointStatus === 'not_set') n++;
    if (setup.sqlLoginStatus === 'not_set') n++;
    if (setup.apiKeyStatus === 'not_set') n++;
    return n;
  }, [setup.dbEndpointStatus, setup.sqlLoginStatus, setup.apiKeyStatus]);

  const menuItems: Array<{ id: string; label: string; icon: any; hint?: string }> = [
    { id: 'status', label: 'Обзор', icon: Gauge, hint: 'Состояние и активные проблемы' },
    { id: 'events', label: 'События', icon: FileText, hint: 'Логи, алерты, расследование' },
    { id: 'clients', label: 'Клиенты', icon: Users, hint: 'Квоты, инфобазы, лимиты' },
    { id: 'settings', label: 'Настройки', icon: SettingsIcon, hint: 'Интеграции и политика' },
  ];

  const badgeFor = (id: string) => {
    if (id === 'events') {
      if (eventsSummary.critical > 0) return <Badge variant="danger" size="sm">{eventsSummary.critical}</Badge>;
      if (eventsSummary.warning > 0) return <Badge variant="warning" size="sm">{eventsSummary.warning}</Badge>;
      return null;
    }
    if (id === 'clients') {
      if (clientOverOrBlocked > 0) return <Badge variant="danger" size="sm">{clientOverOrBlocked}</Badge>;
      if (clientRisk > 0) return <Badge variant="warning" size="sm">{clientRisk}</Badge>;
      return null;
    }
    if (id === 'settings') {
      if (setupMissing > 0) return <Badge variant="warning" size="sm">{setupMissing}</Badge>;
      return null;
    }
    return null;
  };

  return (
    <div className={`${collapsed ? 'w-[76px]' : 'w-72'} bg-slate-950 h-screen flex flex-col text-white flex-shrink-0 border-r border-white/10`}>
      <div className={`px-5 ${collapsed ? 'py-5' : 'py-6'} flex items-center gap-3 border-b border-white/10`}>
        <div className="bg-indigo-500 p-2 rounded-lg">
          <Database size={24} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-semibold text-[15px] leading-tight truncate">1C Session Manager</h1>
            <p className="text-xs text-slate-400">Ops Console</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="ml-auto p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          title={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-2`}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all duration-200 ${
              activeRoute === item.id 
                ? 'bg-indigo-500/20 text-white ring-1 ring-indigo-500/40' 
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
            title={collapsed ? item.label : item.hint}
          >
            <div className="relative">
              <item.icon size={20} />
              {collapsed && (
                <div className="absolute -top-2 -right-2">
                  {badgeFor(item.id)}
                </div>
              )}
            </div>
            {!collapsed && (
              <>
                <span className="font-medium text-sm">{item.label}</span>
                <div className="ml-auto">
                  <div className="flex items-center gap-2">
                    {item.id === 'events' && activeRoute !== 'events' && eventsSummary.newCount > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/20">
                        +{eventsSummary.newCount}
                      </span>
                    ) : null}
                    {badgeFor(item.id)}
                  </div>
                </div>
              </>
            )}
          </button>
        ))}
      </nav>

      <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-white/10`}>

        <div className={`bg-white/5 p-4 rounded-lg mb-3 ${collapsed ? 'hidden' : ''}`}>
          <p className="text-xs text-slate-400 mb-1">Служба</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-medium text-emerald-300">Активна</span>
          </div>
        </div>

        <button
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors`}
          title="Выход (пока не реализовано)"
        >
          <LogOut size={18} />
          {!collapsed && <span>Выход</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
