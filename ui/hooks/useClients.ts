import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '../types';
import { apiFetch, apiFetchJson } from '../services/apiClient';
import { useToast } from './useToast';

export function useClients() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date(0));
  const loadingRef = useRef(true);

  const fetchClients = useCallback(async () => {
    if (!loadingRef.current) setIsRefreshing(true);
    try {
      const data = await apiFetchJson<Client[]>('/api/clients');
      setClients(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch data from backend:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    const interval = setInterval(fetchClients, 10000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const addClient = async (newClient: Omit<Client, 'id'>) => {
    try {
      const savedClient = await apiFetchJson<Client>('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
      setClients(prev => [...prev, savedClient]);
      toast.success({ title: 'Клиент создан', message: `«${savedClient.name}» добавлен.` });
      return true;
    } catch (error) {
      console.error("Error adding client:", error);
      toast.error({ title: 'Ошибка', message: 'Не удалось добавить клиента.' });
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
      toast.success({ title: 'Сохранено', message: `Изменения для «${saved.name}» сохранены.` });
      return true;
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error({ title: 'Ошибка', message: 'Не удалось сохранить изменения клиента.' });
    }
    return false;
  };

  const deleteClient = async (clientId: string) => {
    try {
      const response = await apiFetch(`/api/clients/${clientId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const removed = clients.find(c => c.id === clientId);
        setClients(prev => prev.filter(c => c.id !== clientId));
        toast.success({ title: 'Удалено', message: removed ? `Клиент «${removed.name}» удален.` : 'Клиент удален.' });
        return true;
      }
      toast.error({ title: 'Ошибка', message: `Не удалось удалить клиента (HTTP ${response.status}).` });
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error({ title: 'Ошибка', message: 'Не удалось удалить клиента.' });
    }
    return false;
  };

  return { 
    clients, 
    loading, 
    isRefreshing,
    lastUpdate,
    fetchClients, 
    addClient, 
    updateClient, 
    deleteClient 
  };
}
