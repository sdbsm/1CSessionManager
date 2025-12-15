import React from 'react';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { Button } from '../../components/ui/Button';
import { useUiPrefs } from '../../hooks/useUiPrefs';

interface UiSectionProps {
  theme: 'dark';
  setTheme: (t: 'dark') => void;
}

export const UiSection: React.FC<UiSectionProps> = ({ theme, setTheme }) => {
  const { prefs, updatePrefs, reset } = useUiPrefs();
  return (
    <Card title="Интерфейс" description="Локальные предпочтения (сохраняются в браузере).">
        <div className="space-y-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Плотность таблиц"
              value={prefs.density}
              onChange={(e) => updatePrefs({ density: e.target.value as any })}
              options={[
                { value: 'comfortable', label: 'Комфортно (по умолчанию)' },
                { value: 'compact', label: 'Компактно (больше строк на экране)' }
              ]}
            />

            <Select
              label="Формат времени в событиях"
              value={prefs.timeFormat}
              onChange={(e) => updatePrefs({ timeFormat: e.target.value as any })}
              options={[
                { value: 'absolute', label: 'Абсолютное (дата/время)' },
                { value: 'relative', label: 'Относительное (5м назад)' }
              ]}
            />
          </div>

          <Switch
            checked={prefs.autoRefreshDefault}
            onChange={(checked) => updatePrefs({ autoRefreshDefault: checked })}
            label="Автообновление по умолчанию"
            description="Применяется при открытии «События» (режим Live)."
          />

          <div className="flex items-center justify-end">
            <Button variant="secondary" onClick={reset} title="Сбросить локальные UI-настройки">
              Сбросить UI-настройки
            </Button>
          </div>
        </div>
    </Card>
  );
};
