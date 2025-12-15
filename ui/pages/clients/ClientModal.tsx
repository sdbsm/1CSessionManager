import React, { useState, useEffect } from 'react';
import { Client, ClientDatabase } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DatabaseSelection } from './DatabaseSelection';

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
  const [modalTab, setModalTab] = useState<'info' | 'databases'>('info');
  const [formData, setFormData] = useState({
    name: '',
    maxSessions: 10,
    status: 'active' as Client['status']
  });
  const [manualDbInput, setManualDbInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        setFormData({
          name: editingClient.name,
          maxSessions: editingClient.maxSessions,
          status: editingClient.status
        });
        setManualDbInput(editingClient.databases.map(d => d.name).join(', '));
      } else {
        setFormData({
          name: '',
          maxSessions: 10,
          status: 'active'
        });
        setManualDbInput('');
      }
      setModalTab('info');
    }
  }, [isOpen, editingClient]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const dbNames: string[] = manualDbInput
        .split(/[\n,]+/) 
        .map(s => s.trim())
        .filter(s => s !== '');

    const uniqueDbNames: string[] = Array.from(new Set<string>(dbNames));

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
      alert(`Следующие базы данных уже привязаны к другим клиентам:\n${conflictingDbs.join(', ')}\n\nКаждая база может быть привязана только к одному клиенту.`);
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
      name: formData.name,
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
      <div className="flex border-b mb-6 border-white/10 bg-transparent">
        <button
          onClick={() => setModalTab('info')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            modalTab === 'info'
              ? 'text-indigo-200 border-b-2 border-indigo-600 bg-transparent'
              : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          Основная информация
        </button>
        <button
          onClick={() => setModalTab('databases')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            modalTab === 'databases'
              ? 'text-indigo-200 border-b-2 border-indigo-600 bg-transparent'
              : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          Базы данных
        </button>
      </div>

      <form id="clientForm" onSubmit={handleSubmit} className="space-y-6">
        {modalTab === 'info' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Название организации"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
                placeholder='ООО "Вектор"'
              />
              
              <div>
                 <Input
                    label="Лимит сеансов (0 = Безлимит)"
                    type="number"
                    min="0"
                    value={formData.maxSessions}
                    onChange={e => setFormData({...formData, maxSessions: parseInt(e.target.value) || 0})}
                    required
                 />
              </div>
            </div>

            <Select
              label="Статус"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as Client['status']})}
              options={[
                { value: 'active', label: 'Активен' },
                { value: 'warning', label: 'Внимание (Warning)' },
                { value: 'blocked', label: 'Заблокирован' }
              ]}
            />
          </>
        ) : (
          <DatabaseSelection 
            manualDbInput={manualDbInput}
            setManualDbInput={setManualDbInput}
            clients={clients}
            editingClient={editingClient}
          />
        )}
      </form>
    </Modal>
  );
};
