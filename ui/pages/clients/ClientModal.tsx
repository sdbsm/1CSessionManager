import React, { useState, useEffect } from 'react';
import { Client, ClientDatabase } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DatabaseSelection } from './DatabaseSelection';
import { useToast } from '../../hooks/useToast';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClient: Client | null;
  onSave: (clientData: any) => void;
  clients: Client[];
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  editingClient,
  onSave,
  clients
}) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    maxSessions: 10,
    status: 'active' as Client['status']
  });
  const [selectedDbNames, setSelectedDbNames] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        setFormData({
          name: editingClient.name,
          maxSessions: editingClient.maxSessions,
          status: editingClient.status
        });
        setSelectedDbNames(editingClient.databases.map(d => d.name));
      } else {
        setFormData({
          name: '',
          maxSessions: 10,
          status: 'active'
        });
        setSelectedDbNames([]);
      }
    }
  }, [isOpen, editingClient]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const name = (formData.name || '').trim();
    if (!name) {
      toast.warning({ title: 'Проверьте поля', message: 'Укажите название клиента.' });
      return;
    }

    const uniqueDbNames: string[] = Array.from(
      new Set<string>(selectedDbNames.map(s => s.trim()).filter(Boolean))
    );

    // Conflict check
    const conflictingDbs: string[] = [];
    uniqueDbNames.forEach(dbName => {
      const assignedToClient = clients.find(c => {
        if (editingClient && c.id === editingClient.id) return false;
        return c.databases.some(d => d.name === dbName);
      });
      
      if (assignedToClient) {
        conflictingDbs.push(dbName);
      }
    });

    if (conflictingDbs.length > 0) {
      toast.error({
        title: 'Конфликт привязки',
        message: `Следующие базы уже привязаны к другим клиентам:\n${conflictingDbs.join(', ')}\n\nКаждая база может быть привязана только к одному клиенту.`
      });
      return;
    }

    const newDatabases: ClientDatabase[] = uniqueDbNames.map(name => {
      const existing = editingClient?.databases.find(d => d.name === name);
      return {
        name,
        activeSessions: existing ? existing.activeSessions : 0
      };
    });

    const totalActive = newDatabases.reduce((sum, db) => sum + db.activeSessions, 0);

    const clientData = {
      name,
      maxSessions: formData.maxSessions,
      status: formData.status,
      databases: newDatabases,
      activeSessions: totalActive
    };

    console.log('Sending client data:', clientData);

    onSave(clientData);
    onClose();
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>Отмена</Button>
      <Button onClick={() => handleSubmit()}>{editingClient ? 'Сохранить изменения' : 'Создать клиента'}</Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClient ? 'Редактирование клиента' : 'Новый клиент'}
      size="lg"
      footer={footer}
    >
      <form id="clientForm" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Название клиента"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder='ООО "Вектор"'
          />

          <Input
            label="Лимит сеансов (0 = Безлимит)"
            type="number"
            min="0"
            value={formData.maxSessions}
            onChange={e => setFormData({ ...formData, maxSessions: parseInt(e.target.value) || 0 })}
            required
          />
        </div>

        <Select
          label="Статус"
          value={formData.status}
          onChange={e => setFormData({ ...formData, status: e.target.value as Client['status'] })}
          options={[
            { value: 'active', label: 'Активен' },
            { value: 'warning', label: 'Внимание' },
            { value: 'blocked', label: 'Заблокирован' }
          ]}
        />

        <div className="pt-2">
          <div className="text-sm font-semibold text-slate-50">Инфобазы</div>
          <div className="text-xs text-slate-400 mt-1">
            Выберите инфобазы из списка агента. Каждая инфобаза может быть привязана только к одному клиенту.
          </div>
          <div className="mt-3">
            <DatabaseSelection
              selectedDbNames={selectedDbNames}
              setSelectedDbNames={setSelectedDbNames}
              clients={clients}
              editingClient={editingClient}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
