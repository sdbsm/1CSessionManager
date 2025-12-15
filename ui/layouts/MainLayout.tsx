import React from 'react';
import Sidebar from '../components/Sidebar';
import { Header } from '../components/Header';
import { useServerInfo } from '../hooks/useServerInfo';

interface MainLayoutProps {
  children: React.ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeRoute,
  onNavigate,
}) => {
  const serverInfo = useServerInfo();

  return (
    <div className="dark flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={onNavigate}
      />
      
      <main className="flex-1 overflow-y-auto h-screen">
        <Header 
          serverInfo={serverInfo}
        />

        <div className="p-6 max-w-[1240px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
