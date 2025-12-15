import React, { useEffect, useState } from 'react';
import Dashboard from './pages/dashboard/DashboardPage';
import Clients from './pages/clients/ClientsPage';
import Settings from './pages/settings/SettingsPage';
import Events from './pages/events/EventsPage';
import { MainLayout } from './layouts/MainLayout';
import { useTimeRange } from './hooks/useTimeRange';
import { useClients } from './hooks/useClients';
import { Spinner } from './components/ui/Spinner';

type RouteId = 'status' | 'events' | 'clients' | 'settings';

function getRouteFromHash(): RouteId {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const path = raw.startsWith('/') ? raw.slice(1) : raw;
  const route = (path.split('?')[0] || '').trim();
  switch (route) {
    case 'events':
    case 'clients':
    case 'settings':
    case 'status':
      return route;
    default:
      return 'status';
  }
}

function setRouteHash(route: RouteId) {
  const next = `#/${route}`;
  if (window.location.hash !== next) window.location.hash = next;
}

const App: React.FC = () => {
  const [route, setRoute] = useState<RouteId>(() => getRouteFromHash());
  const { range: timeRange, preset: timePreset, setPreset: setTimePreset } = useTimeRange();
  const { clients, loading, addClient, updateClient, deleteClient } = useClients();

  // Hash routing
  useEffect(() => {
    const onHash = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', onHash);
    // normalize
    if (!window.location.hash) setRouteHash('status');
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const renderContent = () => {
    if (loading && clients.length === 0) {
      return (
        <Spinner centered text="Загрузка данных..." />
      );
    }

    switch (route) {
      case 'status':
        return <Dashboard clients={clients} timeRange={timeRange} timePreset={timePreset} setTimePreset={setTimePreset} />;
      case 'clients':
        return (
          <Clients 
            clients={clients} 
            onAdd={addClient}
            onUpdate={updateClient}
            onDelete={deleteClient}
          />
        );
      case 'settings':
        return <Settings />;
      case 'events':
        return <Events timeRange={timeRange} clients={clients} timePreset={timePreset} setTimePreset={setTimePreset} />;
      default:
        return <Dashboard clients={clients} timeRange={timeRange} timePreset={timePreset} setTimePreset={setTimePreset} />;
    }
  };

  return (
    <MainLayout
      activeRoute={route}
      onNavigate={(r) => setRouteHash(r as RouteId)}
    >
      {renderContent()}
    </MainLayout>
  );
};

export default App;
