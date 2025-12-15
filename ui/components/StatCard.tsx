import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'red' | 'orange';
  onClick?: () => void;
  hrefHash?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  trendValue,
  color = 'blue',
  onClick,
  hrefHash
}) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-200 ring-1 ring-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20',
    orange: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20',
  };

  const clickable = !!onClick || !!hrefHash;

  const handle = () => {
    if (onClick) return onClick();
    if (hrefHash) window.location.hash = hrefHash;
  };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-slate-950/40 p-6 shadow-sm hover:shadow-panel transition-shadow duration-300 ${
        clickable ? 'cursor-pointer hover:bg-white/5' : ''
      }`}
      onClick={clickable ? handle : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handle();
        }
      } : undefined}
      title={clickable ? 'Открыть детали' : undefined}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <h2 className="text-3xl font-bold text-slate-50">{value}</h2>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend === 'up'
              ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/20'
              : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20'
          }`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-2 text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
};

export default StatCard;