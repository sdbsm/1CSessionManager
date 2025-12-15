import React from 'react';
import { Activity, AlertTriangle, Settings as SettingsIcon, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const QuickActions: React.FC = () => {
  return (
    <Card
      title="Быстрые действия"
      description="Сначала риски → затем причины → затем действие."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={<AlertTriangle size={16} />}
          onClick={() => { window.location.hash = '#/events?levels=critical,warning'; }}
        >
          События: critical+warning
        </Button>
        <Button
          variant="secondary"
          icon={<Users size={16} />}
          onClick={() => { window.location.hash = '#/clients?ops=over'; }}
          title="Клиенты с лимитом: факт ≥ план или блокировка"
        >
          Клиенты: перелимит
        </Button>
        <Button
          variant="secondary"
          icon={<Activity size={16} />}
          onClick={() => { window.location.hash = '#/clients?ops=risk'; }}
          title="Клиенты с лимитом: 80–99%"
        >
          Клиенты: в риске
        </Button>
        <Button
          variant="secondary"
          icon={<SettingsIcon size={16} />}
          onClick={() => { window.location.hash = '#/settings'; }}
        >
          Настройки
        </Button>
      </div>
    </Card>
  );
};


