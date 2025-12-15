import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  description,
  footer,
  noPadding = false,
}) => {
  return (
    <div className={`rounded-xl border border-white/10 bg-slate-950/40 shadow-sm overflow-hidden ${className}`}>
      {(title || description) && (
        <div className="px-6 py-4 border-b border-white/10">
          {title && <h3 className="text-lg font-semibold text-slate-50">{title}</h3>}
          {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-white/5 border-t border-white/10">
          {footer}
        </div>
      )}
    </div>
  );
};
