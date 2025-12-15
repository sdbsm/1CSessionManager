import React from 'react';
import { X, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ToastVariant, useToastContext } from './ToastContext';

function variantStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return {
        ring: 'ring-emerald-500/20',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/10',
        icon: <CheckCircle2 size={16} className="text-emerald-300" />
      };
    case 'warning':
      return {
        ring: 'ring-amber-500/20',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/10',
        icon: <AlertTriangle size={16} className="text-amber-300" />
      };
    case 'error':
      return {
        ring: 'ring-rose-500/20',
        border: 'border-rose-500/20',
        bg: 'bg-rose-500/10',
        icon: <XCircle size={16} className="text-rose-300" />
      };
    case 'info':
    default:
      return {
        ring: 'ring-indigo-500/20',
        border: 'border-indigo-500/20',
        bg: 'bg-indigo-500/10',
        icon: <Info size={16} className="text-indigo-300" />
      };
  }
}

export const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-full max-w-sm space-y-2">
      {toasts.map(t => {
        const s = variantStyles(t.variant);
        return (
          <div
            key={t.id}
            className={`rounded-xl border ${s.border} ${s.bg} ring-1 ${s.ring} shadow-xl backdrop-blur-sm overflow-hidden`}
            role="status"
            aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
          >
            <div className="p-4 flex gap-3">
              <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
              <div className="min-w-0 flex-1">
                {t.title && <div className="text-sm font-semibold text-slate-50">{t.title}</div>}
                <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
                aria-label="Закрыть уведомление"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};


