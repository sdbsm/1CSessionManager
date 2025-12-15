import React from 'react';
import Sidebar from '../components/Sidebar';
import { Header } from '../components/Header';
import { useServerInfo } from '../hooks/useServerInfo';
import { TimeRange } from '../hooks/useTimeRange';
import { Client } from '../types';
import { CommandPalette } from '../components/ui/CommandPalette';
import { Breadcrumbs } from '../components/Breadcrumbs';

interface MainLayoutProps {
  children: React.ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
  clients: Client[];
  timeRange: TimeRange;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeRoute,
  onNavigate,
  clients,
  timeRange,
}) => {
  const serverInfo = useServerInfo();
  const [cmdkOpen, setCmdkOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      const isCmdK = (e.ctrlKey || e.metaKey) && isK;
      if (!isCmdK) return;
      e.preventDefault();
      setCmdkOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dark flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        clients={clients}
        timeRange={timeRange}
        onOpenCommandPalette={() => setCmdkOpen(true)}
      />
      
      <main className="flex-1 overflow-y-auto h-screen">
        <Header 
          serverInfo={serverInfo}
        />
        <Breadcrumbs clients={clients} />

        <div className="p-6 max-w-[1240px] mx-auto">
          {children}
        </div>
      </main>

      <CommandPalette
        clients={clients}
        timeRange={timeRange}
        isOpen={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
      />
    </div>
  );
};
