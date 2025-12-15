import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  centered?: boolean;
  text?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  className = '', 
  centered = false,
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const content = (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Loader2 className={`animate-spin text-indigo-600 dark:text-indigo-400 ${sizeClasses[size]}`} />
      {text && <span className="text-sm text-slate-500 dark:text-slate-400">{text}</span>}
    </div>
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[100px]">
        {content}
      </div>
    );
  }

  return content;
};
