
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Events from './pages/Events';
import { Client, SystemEvent } from './types';
import { apiFetch } from './services/apiClient';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState<{ hostname: string; osVersion: string } | null>(null);

  // Fetch data function
  const fetchData = async () => {
    try {
      const [clientsRes, eventsRes] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch('/api/events')
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch (error) {
      console.error("Failed to fetch data from backend:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data from Backend API
  useEffect(() => {
    fetchData();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch server info
  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const response = await apiFetch('/api/server/info');
        if (response.ok) {
          const info = await response.json();
          setServerInfo(info);
        }
      } catch (error) {
        console.error("Failed to fetch server info:", error);
      }
    };
    fetchServerInfo();
  }, []);

  // Handlers for Client Management (API calls)
  const handleAddClient = async (newClient: Omit<Client, 'id'>) => {
    try {
      const response = await apiFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
      if (response.ok) {
        const savedClient = await response.json();
        setClients(prev => [...prev, savedClient]);
      }
    } catch (error) {
      console.error("Error adding client:", error);
      alert("Ошибка при добавлении клиента");
    }
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    try {
      const response = await apiFetch(`/api/clients/${updatedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedClient)
      });
      if (response.ok) {
        const saved = await response.json();
        setClients(prev => prev.map(c => c.id === saved.id ? saved : c));
      }
    } catch (error) {
      console.error("Error updating client:", error);
      alert("Ошибка при обновлении клиента");
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этого клиента? Это действие необратимо.')) {
      try {
        const response = await apiFetch(`/api/clients/${clientId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setClients(prev => prev.filter(c => c.id !== clientId));
        }
      } catch (error) {
        console.error("Error deleting client:", error);
        alert("Ошибка при удалении клиента");
      }
    }
  };

  const renderContent = () => {
    if (loading && clients.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
          Загрузка данных...
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard clients={clients} events={events} />;
      case 'clients':
        return (
          <Clients 
            clients={clients} 
            onAdd={handleAddClient}
            onUpdate={handleUpdateClient}
            onDelete={handleDeleteClient}
          />
        );
      case 'settings':
        return <Settings />;
      case 'events':
        return <Events events={events} onEventsChange={fetchData} />;
      default:
        return <Dashboard clients={clients} events={events} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto h-screen">
        <header className="bg-white h-16 border-b border-slate-200 flex items-center px-8 justify-between sticky top-0 z-10">
          <h2 className="text-sm font-medium text-slate-500">
            Сервер: <span className="text-slate-800 font-bold">
              {serverInfo?.hostname || 'Загрузка...'}
            </span> {serverInfo?.osVersion && `(${serverInfo.osVersion})`}
          </h2>
          <div className="flex items-center gap-4">
             <div className="text-right">
                <div className="text-sm font-bold text-slate-800">Administrator</div>
                <div className="text-xs text-slate-400">System Admin</div>
             </div>
             <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                A
             </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
