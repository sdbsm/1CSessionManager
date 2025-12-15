import React from 'react';
import { Activity, AlertTriangle, Users, LayoutGrid, Globe } from 'lucide-react';
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
          Проблемы (Critical)
        </Button>
        <Button
          variant="secondary"
          icon={<Users size={16} />}
          onClick={() => { window.location.hash = '#/clients?ops=over'; }}
          title="Клиенты с лимитом: факт ≥ план или блокировка"
        >
          Перелимит
        </Button>
        <Button
          variant="secondary"
          icon={<Activity size={16} />}
          onClick={() => { window.location.hash = '#/clients?ops=risk'; }}
          title="Клиенты с лимитом: 80–99%"
        >
          В риске
        </Button>
        <div className="w-px bg-white/10 h-6 mx-1 self-center" />
        <Button
          variant="secondary"
          icon={<LayoutGrid size={16} />}
          onClick={() => { window.location.hash = '#/clients/infobases'; }}
        >
          Нераспределённые базы
        </Button>
        <Button
          variant="secondary"
          icon={<Globe size={16} />}
          onClick={() => { window.location.hash = '#/clients/publications?view=mass-update'; }}
        >
          Смена платформы
        </Button>
      </div>
    </Card>
  );
};


