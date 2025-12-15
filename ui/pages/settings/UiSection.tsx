import React from 'react';
import { Card } from '../../components/ui/Card';

interface UiSectionProps {
  theme: 'dark';
  setTheme: (t: 'dark') => void;
}

export const UiSection: React.FC<UiSectionProps> = ({ theme, setTheme }) => {
  return (
    <Card title="Интерфейс" description="Локальные предпочтения (сохраняются в браузере).">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-200">Тема</div>
            <div className="text-xs text-slate-400">Сейчас доступна только тёмная (ops-friendly).</div>
          </div>
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden bg-white/5">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-200 hover:bg-white/10'}`}
            >
              Dark
            </button>
          </div>
        </div>
    </Card>
  );
};
