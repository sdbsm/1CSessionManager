import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = ''
}) => {
  const variants = {
    primary: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-1 dark:ring-indigo-500/20',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-500/20',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20',
    danger: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-1 dark:ring-rose-500/20',
    neutral: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:ring-1 dark:ring-white/10',
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-1 dark:ring-sky-500/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};
