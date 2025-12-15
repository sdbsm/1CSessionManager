import React, { useState } from 'react';
import { Server, Terminal, Save, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AppSettings } from '../../types';

import { Select } from '../../components/ui/Select';

interface OneCSectionProps {
  settings: AppSettings;
  onChange: (field: keyof AppSettings, value: any) => void;
  onSave: () => void;
  saving: boolean;
  onTest: (settings: AppSettings) => Promise<{ success: boolean; message: string }>;
  errors?: Partial<Record<keyof AppSettings, string>>;
}

export const OneCSection: React.FC<OneCSectionProps> = ({
  settings,
  onChange,
  onSave,
  saving,
  onTest,
  errors
}) => {
  const versions = settings.installedVersionsJson ? JSON.parse(settings.installedVersionsJson) as string[] : [];
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await onTest(settings);
    setTestResult(result);
    setTesting(false);
  };

  const handleVersionChange = (ver: string) => {
    onChange('defaultOneCVersion', ver);
    if (ver) {
        // Auto-set RAC path based on version
        const path = `C:\\Program Files\\1cv8\\${ver}\\bin\\rac.exe`;
        onChange('racPath', path);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 text-blue-200 rounded-lg ring-1 ring-blue-500/20">
          <Server size={24} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Интеграция 1С (RAC/RAS)</h2>
          <p className="text-xs text-slate-400">Сначала подключение, затем проверка. Пароль хранится защищённо.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <label className="block text-sm font-medium text-slate-300 mb-2">Версия платформы 1С</label>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <Select
                            value={settings.defaultOneCVersion || ''}
                            onChange={(e) => handleVersionChange(e.target.value)}
                            options={[
                                { value: '', label: '-- Выберите версию (авто-настройка) --' },
                                ...versions.map(v => ({ value: v, label: v }))
                            ]}
                            error={errors?.defaultOneCVersion}
                        />
                    </div>
                    <div className="w-[200px]">
                        <Input 
                            label="" 
                            value={settings.rasHost} 
                            onChange={e => onChange('rasHost', e.target.value)} 
                            placeholder="localhost:1545"
                            className="bg-transparent"
                            error={errors?.rasHost}
                        />
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    Выбор версии автоматически настроит путь к <code>rac.exe</code>. 
                    RAS Host по умолчанию: <code>localhost:1545</code>.
                </p>
            </div>
        </div>

        <div className="md:col-span-2">
            <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
                {showAdvanced ? 'Скрыть расширенные настройки' : 'Показать расширенные настройки (пути, интервалы)'}
            </button>
        </div>

        {showAdvanced && (
            <>
                <Input 
                    label="Интервал проверки (сек)" 
                    type="number"
                    value={settings.checkInterval} 
                    onChange={e => onChange('checkInterval', parseInt(e.target.value) || 0)} 
                    error={errors?.checkInterval}
                />
                <div className="md:col-span-2">
                    <Input 
                        label="Путь к утилите rac.exe" 
                        value={settings.racPath} 
                        onChange={e => onChange('racPath', e.target.value)} 
                        className="font-mono text-sm"
                        error={errors?.racPath}
                    />
                </div>
            </>
        )}

        <Input 
            label="Администратор кластера" 
            value={settings.clusterUser} 
            onChange={e => onChange('clusterUser', e.target.value)} 
            placeholder="Administrator"
            error={errors?.clusterUser}
        />
        <Input 
            label="Пароль администратора" 
            type="password" 
            value={settings.clusterPass} 
            onChange={e => onChange('clusterPass', e.target.value)} 
            placeholder="••••••••"
        />
      </div>

      <div className="mt-6 rounded-lg p-4 border border-white/10 bg-white/5">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-200">Проверка подключения</h3>
            <Button size="sm" variant="secondary" onClick={handleTest} isLoading={testing} icon={<Terminal size={12}/>}>Проверить</Button>
        </div>

        {testResult && (
            <div className={`text-xs font-mono p-3 rounded border overflow-x-auto whitespace-pre-wrap ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-rose-500/10 border-rose-500/20 text-rose-200'}`}>
                <div className="flex items-center gap-2 mb-1 font-bold">
                {testResult.success ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                {testResult.success ? 'УСПЕХ (SUCCESS)' : 'ОШИБКА (ERROR)'}
                </div>
                {testResult.message}
            </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onSave} isLoading={saving} icon={<Save size={16}/>}>Сохранить настройки 1С</Button>
      </div>
    </Card>
  );
};
