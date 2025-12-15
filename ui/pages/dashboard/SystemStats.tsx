import React from 'react';
import { Cpu, Database, HardDrive } from 'lucide-react';
import StatCard from '../../components/StatCard';

interface SystemStatsProps {
  serverMetrics?: {
    cpu: number;
    memory: { used: number; total: number; percent: number };
    disks?: { Name: string; TotalGB: number; FreeGB: number }[];
  };
  totalDatabases?: number;
  totalDbSizeGB?: number;
}

export const SystemStats: React.FC<SystemStatsProps> = ({ serverMetrics, totalDatabases, totalDbSizeGB }) => {
  const cpu = serverMetrics?.cpu ?? 0;
  const mem = serverMetrics?.memory ?? { used: 0, total: 0, percent: 0 };
  const disk = serverMetrics?.disks?.[0]; // Show first disk (usually C:) or summary
  
  const diskPercent = disk 
    ? Math.round(((disk.TotalGB - disk.FreeGB) / disk.TotalGB) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
       <StatCard
         title="CPU"
         value={`${cpu}%`}
         description="Загрузка процессора"
         icon={Cpu}
         color={cpu > 80 ? 'red' : cpu > 50 ? 'orange' : 'green'}
       />
       <StatCard
         title="RAM"
         value={`${mem.percent}%`}
         description={`${mem.used} MB / ${mem.total} MB`}
         icon={HardDrive}
         color={mem.percent > 90 ? 'red' : mem.percent > 70 ? 'orange' : 'green'}
       />
       <StatCard
         title="Диск (C:)"
         value={disk ? `${diskPercent}%` : "—"}
         description={disk ? `${disk.FreeGB} GB свободно из ${disk.TotalGB}` : "Нет данных"}
         icon={HardDrive}
         color={diskPercent > 90 ? 'red' : diskPercent > 75 ? 'orange' : 'green'}
       />
       <StatCard
         title="Инфобазы"
         value={`${totalDatabases ?? 0}`}
         description={totalDbSizeGB ? `Общий объем: ${totalDbSizeGB} GB` : "Количество ИБ"}
         icon={Database}
         color="blue"
       />
    </div>
  );
};
