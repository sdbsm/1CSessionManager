import { useState, useEffect, useCallback } from 'react';
import { Client } from '../types';
import { apiFetch, apiFetchJson } from '../services/apiClient';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    try {
      const data = await apiFetchJson<Client[]>('/api/clients');
      setClients(data);
    } catch (error) {
      console.error("Failed to fetch data from backend:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    const interval = setInterval(fetchClients, 10000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  const addClient = async (newClient: Omit<Client, 'id'>) => {
    try {
      const savedClient = await apiFetchJson<Client>('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
      setClients(prev => [...prev, savedClient]);
      return true;
    } catch (error) {
      console.error("Error adding client:", error);
      alert("Ошибка при добавлении клиента");
    }
    return false;
  };

  const updateClient = async (updatedClient: Client) => {
    try {
      const saved = await apiFetchJson<Client>(`/api/clients/${updatedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedClient)
      });
      setClients(prev => prev.map(c => c.id === saved.id ? saved : c));
      return true;
    } catch (error) {
      console.error("Error updating client:", error);
      alert("Ошибка при обновлении клиента");
    }
    return false;
  };

  const deleteClient = async (clientId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этого клиента? Это действие необратимо.')) {
      try {
        const response = await apiFetch(`/api/clients/${clientId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setClients(prev => prev.filter(c => c.id !== clientId));
          return true;
        }
      } catch (error) {
        console.error("Error deleting client:", error);
        alert("Ошибка при удалении клиента");
      }
    }
    return false;
  };

  return { 
    clients, 
    loading, 
    fetchClients, 
    addClient, 
    updateClient, 
    deleteClient 
  };
}
