import React, { useMemo, useRef, useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { AppSettings } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { SetupSection } from './SetupSection';
import { OneCSection } from './OneCSection';
import { PolicySection } from './PolicySection';
import { UiSection } from './UiSection';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../hooks/useToast';

type SettingsSection = 'setup' | 'oneC' | 'policy' | 'ui';

function stableSettingsFingerprint(s: AppSettings) {
  // Compare only user-editable fields; avoid storing password text but detect presence.
  return JSON.stringify({
    racPath: s.racPath || '',
    rasHost: s.rasHost || '',
    clusterUser: s.clusterUser || '',
    clusterPassSet: (s.clusterPass || '').trim().length > 0,
    checkInterval: Number(s.checkInterval || 0),
    killMode: !!s.killMode,
    defaultOneCVersion: s.defaultOneCVersion || ''
  });
}

type SettingsErrors = Partial<Record<keyof AppSettings, string>>;

function validateSettings(s: AppSettings): SettingsErrors {
  const errors: SettingsErrors = {};

  // Basic sanity for 1C integration
  const ras = (s.rasHost || '').trim();
  if (!ras) {
    errors.rasHost = 'Укажите RAS host (например, localhost:1545).';
  } else if (!/^[^\\s]+:\\d+$/.test(ras)) {
    // "host:port" minimal check (works for localhost, ip, fqdn)
    errors.rasHost = 'Формат: host:port (например, localhost:1545).';
  }

  const interval = Number(s.checkInterval);
  if (!Number.isFinite(interval) || interval <= 0) {
    errors.checkInterval = 'Интервал должен быть числом > 0.';
  } else if (interval < 5) {
    errors.checkInterval = 'Слишком часто. Рекомендуется ≥ 5 сек.';
  } else if (interval > 3600) {
    errors.checkInterval = 'Слишком редко. Рекомендуется ≤ 3600 сек.';
  }

  const rac = (s.racPath || '').trim();
  if (!rac) {
    errors.racPath = 'Укажите путь к rac.exe (можно выбрать версию — путь подставится).';
  } else if (!rac.toLowerCase().endsWith('\\rac.exe')) {
    errors.racPath = 'Путь должен указывать на rac.exe.';
  }

  if ((s.clusterUser || '').trim().length === 0) {
    errors.clusterUser = 'Укажите пользователя кластера (например, Administrator).';
  }

  return errors;
}

const Settings: React.FC = () => {
  const { settings, loading, saving, saveSettings, testConnection, setSettings } = useSettings();
  const toast = useToast();
  
  // Use setup statuses to display badges in sidebar
  const { dbEndpointStatus, sqlLoginStatus, apiKeyStatus } = useSetupStatus();
  
  const [section, setSection] = useState<SettingsSection>('setup');
  const [uiTheme, setUiTheme] = useState<'dark'>('dark');
  const baselineRef = useRef<AppSettings | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ui.theme', 'dark');
    } catch { /* ignore */ }
    document.documentElement.classList.add('dark');
  }, []);

  if (loading || !settings) {
    return <Spinner centered />;
  }

  // Initialize baseline once when settings are loaded.
  if (!baselineRef.current) {
    baselineRef.current = settings;
  }

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  const isDirty = useMemo(() => {
    const base = baselineRef.current;
    if (!base) return false;
    return stableSettingsFingerprint(base) !== stableSettingsFingerprint(settings);
  }, [settings]);

  const errors = useMemo(() => validateSettings(settings), [settings]);
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const handleSave = async () => {
    if (!isDirty) {
      toast.info({ title: 'Нет изменений', message: 'Настройки не изменялись.' });
      return;
    }
    if (hasErrors) {
      const lines = Object.values(errors).filter(Boolean).slice(0, 5).join('\n');
      toast.error({ title: 'Проверьте настройки', message: lines || 'Некорректные значения.' });
      return;
    }
    const ok = await saveSettings(settings);
    if (ok) {
      baselineRef.current = { ...settings, clusterPass: '' };
      toast.success({ title: 'Сохранено', message: 'Настройки сохранены.' });
    } else {
      toast.error({ title: 'Ошибка', message: 'Не удалось сохранить настройки.' });
    }
  };

  const handleCancel = () => {
    const base = baselineRef.current;
    if (!base) return;
    setSettings({ ...base, clusterPass: '' });
    toast.info({ title: 'Отменено', message: 'Изменения отменены.' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      <PageHeader 
        title="Настройки" 
        description="Структурировано по зонам ответственности: Setup → 1C → Policy → UI."
      />

      {section !== 'setup' && (
        <div className={`rounded-xl border border-white/10 bg-slate-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDirty ? (hasErrors ? 'ring-1 ring-rose-500/20' : 'ring-1 ring-amber-500/20') : ''
        }`}>
          <div className="text-sm">
            <div className="font-semibold text-slate-50">Конфигурация 1C/Policy</div>
            <div className="text-xs text-slate-400">
              {hasErrors ? 'Есть ошибки в полях — исправьте перед сохранением.' : isDirty ? 'Есть несохранённые изменения.' : 'Изменений нет.'}
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="secondary" onClick={handleCancel} disabled={!isDirty || saving}>
              Отменить
            </Button>
            <Button onClick={handleSave} isLoading={saving} disabled={!isDirty || hasErrors}>
              Сохранить
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden h-fit sticky top-[84px]">
          <div className="px-5 py-4 border-b border-white/10 text-sm font-semibold text-slate-50">Разделы</div>
          <div className="p-2 space-y-1">
            <button
              type="button"
              onClick={() => setSection('setup')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'setup' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              Setup (SQL / API‑ключ)
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${dbEndpointStatus === 'set' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-amber-500/10 text-amber-200 border-amber-500/20'}`}>SQL DB</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${sqlLoginStatus === 'set' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-amber-500/10 text-amber-200 border-amber-500/20'}`}>SQL Auth</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${apiKeyStatus === 'set' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-white/5 text-slate-300 border-white/10'}`}>Ключ</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSection('oneC')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'oneC' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              1С (RAC/RAS)
              <div className="mt-1 text-xs text-slate-400">Подключение + проверка</div>
            </button>

            <button
              type="button"
              onClick={() => setSection('policy')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'policy' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              Политика (Kill mode)
              <div className="mt-1 text-xs text-slate-400">{settings.killMode ? 'Активна' : 'Отключена'}</div>
            </button>

            <button
              type="button"
              onClick={() => setSection('ui')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'ui' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              UI
              <div className="mt-1 text-xs text-slate-400">Тема и предпочтения</div>
            </button>
          </div>
        </aside>

        <section className="space-y-6">
          {section === 'setup' && <SetupSection />}
          {section === 'oneC' && (
            <OneCSection 
              settings={settings}
              onChange={handleChange}
              onSave={handleSave}
              saving={saving}
              onTest={testConnection}
              errors={errors}
            />
          )}
          {section === 'policy' && (
             <PolicySection 
                settings={settings}
                onChange={handleChange}
                onSave={handleSave}
                saving={saving}
             />
          )}
          {section === 'ui' && (
             <UiSection theme={uiTheme} setTheme={setUiTheme} />
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;
