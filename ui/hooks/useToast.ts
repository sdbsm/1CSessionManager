import { useCallback } from 'react';
import { ToastVariant, useToastContext } from '../components/ui/toast/ToastContext';

type ToastInput = {
  title?: string;
  message: string;
  durationMs?: number;
};

export function useToast() {
  const { push, dismiss, clear } = useToastContext();

  const notify = useCallback((variant: ToastVariant, input: ToastInput) => {
    return push({
      variant,
      title: input.title,
      message: input.message,
      durationMs: input.durationMs
    });
  }, [push]);

  return {
    notify,
    info: (input: ToastInput) => notify('info', input),
    success: (input: ToastInput) => notify('success', input),
    warning: (input: ToastInput) => notify('warning', input),
    error: (input: ToastInput) => notify('error', input),
    dismiss,
    clear
  };
}


