
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  Server, 
  Sparkles,
  RefreshCw,
  Database,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import StatCard from '../components/StatCard';
import { Client, SystemEvent } from '../types';
// AI analysis moved to server-side API

interface DashboardProps {
  clients: Client[];
  events: SystemEvent[];
}

interface DashboardStats {
  databaseStats: { [key: string]: { sessions: number; sizeMB?: number } };
  connectionTypes: { [key: string]: number };
  clusterStatus: 'online' | 'offline' | 'unknown';
  serverMetrics: {
    cpu: number;
    memory: { used: number; total: number; percent: number };
  };
  lastUpdate: string | null;
}

interface TopClient {
  id: string;
  name: string;
  activeSessions: number;
  maxSessions: number;
  utilization: number;
  status: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

// Format database size helper
const formatDatabaseSize = (sizeMB?: number): string => {
  if (sizeMB === undefined || sizeMB === null) return '—';
  if (sizeMB < 1024) {
    return `${sizeMB.toFixed(1)} MB`;
  }
  return `${(sizeMB / 1024).toFixed(2)} GB`;
};

const Dashboard: React.FC<DashboardProps> = ({ clients, events }) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [warnings, setWarnings] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);

  const totalSessions = clients.reduce((acc, client) => acc + client.activeSessions, 0);
  const totalLimit = clients.reduce((acc, client) => acc + client.maxSessions, 0);
  const utilizationRate = totalLimit > 0 
    ? Math.round((totalSessions / totalLimit) * 100) 
    : 0;

  const activeClients = clients.filter(c => c.activeSessions > 0).length;
  const criticalClients = clients.filter(c => 
    c.status === 'blocked' || 
    (c.maxSessions > 0 && c.activeSessions >= c.maxSessions)
  ).length;

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, topRes, warningsRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/top-clients'),
          fetch('/api/dashboard/warnings')
        ]);

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setDashboardStats(stats);
        }
        if (topRes.ok) {
          const top = await topRes.json();
          setTopClients(top);
        }
        if (warningsRes.ok) {
          const warns = await warningsRes.json();
          setWarnings(warns);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients, events })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiInsight(data.insight);
      } else {
        const error = await response.json();
        setAiInsight(`Ошибка: ${error.message || 'Не удалось выполнить анализ'}`);
      }
    } catch (error: any) {
      console.error('Error generating insight:', error);
      setAiInsight(`Ошибка соединения: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoadingAi(false);
    }
  };

  // Prepare data for database list - show all databases, sorted by size (if available) or name
  const databaseChartData = dashboardStats 
    ? Object.entries(dashboardStats.databaseStats)
        .map(([name, data]: [string, { sessions: number; sizeMB?: number }]) => ({ 
          name, 
          value: data.sessions,
          sizeMB: data.sizeMB 
        }))
        .sort((a, b) => {
          // Sort by size first (if available), then by name
          if (a.sizeMB !== undefined && b.sizeMB !== undefined) {
            return b.sizeMB - a.sizeMB;
          }
          if (a.sizeMB !== undefined) return -1;
          if (b.sizeMB !== undefined) return 1;
          return a.name.localeCompare(b.name);
        })
    : [];

  const connectionTypesData = dashboardStats
    ? Object.entries(dashboardStats.connectionTypes)
        .filter(([_, count]: [string, number]) => count > 0)
        .map(([name, count]: [string, number]) => ({ name, value: count }))
    : [];

  // Calculate database size statistics
  const databaseSizeStats = dashboardStats
    ? (() => {
        const dbsWithSizes = Object.values(dashboardStats.databaseStats)
          .filter((db: { sessions: number; sizeMB?: number }) => db.sizeMB !== undefined && db.sizeMB !== null)
          .map((db: { sessions: number; sizeMB?: number }) => db.sizeMB || 0);
        
        if (dbsWithSizes.length === 0) {
          return { totalSizeMB: 0, totalSizeGB: 0, count: 0, avgSizeMB: 0, avgSizeGB: 0 };
        }
        
        const totalSizeMB = dbsWithSizes.reduce((sum, size) => sum + size, 0);
        const totalSizeGB = totalSizeMB / 1024;
        const count = dbsWithSizes.length;
        const avgSizeMB = totalSizeMB / count;
        const avgSizeGB = avgSizeMB / 1024;
        
        return { totalSizeMB, totalSizeGB, count, avgSizeMB, avgSizeGB };
      })()
    : { totalSizeMB: 0, totalSizeGB: 0, count: 0, avgSizeMB: 0, avgSizeGB: 0 };

  const criticalEvents = events
    .filter(e => e.level === 'critical' || e.level === 'warning')
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Панель мониторинга</h1>
        <button 
          onClick={handleGenerateInsight}
          disabled={loadingAi}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition-all disabled:opacity-50"
        >
          {loadingAi ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
          {loadingAi ? 'Анализ...' : 'AI Анализ состояния'}
        </button>
      </div>

      {aiInsight && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-6 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mt-1">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">Gemini AI Insight</h3>
              <div className="prose prose-sm text-slate-700 max-w-none whitespace-pre-wrap">
                {aiInsight}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Секция 1: Ключевые метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Загрузка лицензий" 
          value={`${utilizationRate}%`} 
          description={`${totalSessions} / ${totalLimit} сеансов`}
          icon={Activity}
          color={utilizationRate > 80 ? 'orange' : utilizationRate > 50 ? 'blue' : 'green'}
        />
        <StatCard 
          title="Активные клиенты" 
          value={`${activeClients} / ${clients.length}`} 
          description="С активными сеансами"
          icon={Users}
          color="green"
        />
        <StatCard 
          title="Критические ситуации" 
          value={criticalClients} 
          description="На лимите или заблокированы"
          icon={AlertTriangle}
          color="red"
        />
        <StatCard 
          title="Статус кластера 1С" 
          value={dashboardStats?.clusterStatus === 'online' ? 'Онлайн' : 'Офлайн'} 
          icon={Server}
          color={dashboardStats?.clusterStatus === 'online' ? 'green' : 'red'}
        />
        <StatCard 
          title="Использование ОЗУ" 
          value={dashboardStats?.serverMetrics ? `${dashboardStats.serverMetrics.memory.percent}%` : '—'} 
          description={dashboardStats?.serverMetrics 
            ? `${dashboardStats.serverMetrics.memory.used.toFixed(1)} / ${dashboardStats.serverMetrics.memory.total.toFixed(1)} GB`
            : 'Загрузка...'}
          icon={HardDrive}
          color={dashboardStats?.serverMetrics?.memory.percent 
            ? (dashboardStats.serverMetrics.memory.percent > 80 ? 'orange' : dashboardStats.serverMetrics.memory.percent > 60 ? 'blue' : 'green')
            : 'blue'}
        />
        <StatCard 
          title="Загрузка CPU" 
          value={dashboardStats?.serverMetrics ? `${dashboardStats.serverMetrics.cpu}%` : '—'} 
          description="Процессор сервера"
          icon={Cpu}
          color={dashboardStats?.serverMetrics?.cpu 
            ? (dashboardStats.serverMetrics.cpu > 80 ? 'orange' : dashboardStats.serverMetrics.cpu > 60 ? 'blue' : 'green')
            : 'blue'}
        />
        <StatCard 
          title="Общий размер БД" 
          value={databaseSizeStats.count > 0 ? formatDatabaseSize(databaseSizeStats.totalSizeMB).replace(' MB', '').replace(' GB', '') : '—'} 
          description={databaseSizeStats.count > 0 
            ? `${databaseSizeStats.count} баз, средний: ${formatDatabaseSize(databaseSizeStats.avgSizeMB)}`
            : 'Размеры БД недоступны'}
          icon={Database}
          color={databaseSizeStats.count > 0 ? 'blue' : 'blue'}
        />
      </div>

      {/* Секция 2: Детальная аналитика (3 колонки) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка */}
        <div className="space-y-6">
          {/* Топ-5 клиентов */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Топ-5 клиентов</h3>
            <div className="space-y-3">
              {topClients.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Нет данных</p>
              ) : (
                topClients.map((client, index) => (
                  <div key={client.id} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700">{index + 1}. {client.name}</span>
                      <span className="text-slate-600">{client.activeSessions}/{client.maxSessions}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          client.utilization >= 100 ? 'bg-red-500' :
                          client.utilization >= 80 ? 'bg-orange-500' :
                          'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(client.utilization, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500">{client.utilization}% использования</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Предупреждения */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={20} />
              Предупреждения
            </h3>
            <div className="space-y-3">
              {warnings.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Нет предупреждений</p>
              ) : (
                warnings.map(warning => (
                  <div key={warning.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="font-medium text-slate-800 text-sm">{warning.name}</div>
                    <div className="text-xs text-slate-600 mt-1">{warning.reason}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {warning.activeSessions}/{warning.maxSessions} сеансов ({warning.utilization}%)
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Средняя колонка */}
        <div className="space-y-6">
          {/* Распределение по базам данных */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Распределение по БД</h3>
            {databaseChartData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={databaseChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {databaseChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Типы подключений */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Типы подключений</h3>
            {connectionTypesData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={connectionTypesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {connectionTypesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Правая колонка */}
        <div className="space-y-6">
          {/* Статистика баз данных */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Database size={20} />
              Все базы данных
            </h3>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {databaseChartData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Нет данных</p>
              ) : (
                databaseChartData.map((db, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700 truncate block">{db.name}</span>
                      {db.sizeMB !== undefined && db.sizeMB !== null && (
                        <span className="text-xs text-slate-500">{formatDatabaseSize(db.sizeMB)}</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-600 font-mono ml-2 flex-shrink-0">{db.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Последние критические события */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Критические события</h3>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {criticalEvents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Нет критических событий</p>
              ) : (
                criticalEvents.map(event => (
                  <div key={event.id} className="flex gap-2 items-start pb-2 border-b border-slate-100 last:border-0">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      event.level === 'critical' ? 'bg-red-500' : 'bg-orange-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 font-medium truncate">{event.message}</p>
                      <span className="text-xs text-slate-400">{event.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
