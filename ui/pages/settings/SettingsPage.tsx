import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { AppSettings } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { SetupSection } from './SetupSection';
import { OneCSection } from './OneCSection';
import { PolicySection } from './PolicySection';
import { UiSection } from './UiSection';

type SettingsSection = 'setup' | 'oneC' | 'policy' | 'ui';

const Settings: React.FC = () => {
  const { settings, loading, saving, saveSettings, testConnection, setSettings } = useSettings();
  
  // Use setup statuses to display badges in sidebar
  const { dbEndpointStatus, sqlLoginStatus, apiKeyStatus } = useSetupStatus();
  
  const [section, setSection] = useState<SettingsSection>('setup');
  const [uiTheme, setUiTheme] = useState<'dark'>('dark');

  useEffect(() => {
    try {
      localStorage.setItem('ui.theme', 'dark');
    } catch { /* ignore */ }
    document.documentElement.classList.add('dark');
  }, []);

  if (loading || !settings) {
    return <Spinner centered />;
  }

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  const handleSave = () => saveSettings(settings);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      <PageHeader 
        title="Настройки" 
        description="Структурировано по зонам ответственности: Setup → 1C → Policy → UI."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden h-fit sticky top-[84px]">
          <div className="px-5 py-4 border-b border-white/10 text-sm font-semibold text-slate-50">Разделы</div>
          <div className="p-2 space-y-1">
            <button
              type="button"
              onClick={() => setSection('setup')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'setup' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              Setup (DB / API key)
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${dbEndpointStatus === 'set' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-amber-500/10 text-amber-200 border-amber-500/20'}`}>DB</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${sqlLoginStatus === 'set' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-amber-500/10 text-amber-200 border-amber-500/20'}`}>SQL</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${apiKeyStatus === 'set' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-white/5 text-slate-300 border-white/10'}`}>Key</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSection('oneC')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'oneC' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              1C (RAC/RAS)
              <div className="mt-1 text-xs text-slate-400">Подключение + проверка</div>
            </button>

            <button
              type="button"
              onClick={() => setSection('policy')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${section === 'policy' ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/20' : 'text-slate-200 hover:bg-white/5'}`}
            >
              Policy (Kill mode)
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
