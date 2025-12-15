import React, { useState } from 'react';
import { Server, Terminal, Save, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AppSettings } from '../../types';

interface OneCSectionProps {
  settings: AppSettings;
  onChange: (field: keyof AppSettings, value: any) => void;
  onSave: () => void;
  saving: boolean;
  onTest: (settings: AppSettings) => Promise<{ success: boolean; message: string }>;
}

export const OneCSection: React.FC<OneCSectionProps> = ({
  settings,
  onChange,
  onSave,
  saving,
  onTest
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await onTest(settings);
    setTestResult(result);
    setTesting(false);
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
        <Input 
            label="Хост (RAS)" 
            value={settings.rasHost} 
            onChange={e => onChange('rasHost', e.target.value)} 
            placeholder="localhost:1545"
        />
        <Input 
            label="Интервал проверки (сек)" 
            type="number"
            value={settings.checkInterval} 
            onChange={e => onChange('checkInterval', parseInt(e.target.value))} 
        />
        <div className="md:col-span-2">
            <Input 
                label="Путь к утилите rac.exe" 
                value={settings.racPath} 
                onChange={e => onChange('racPath', e.target.value)} 
                className="font-mono text-sm"
            />
        </div>
        <Input 
            label="Администратор кластера" 
            value={settings.clusterUser} 
            onChange={e => onChange('clusterUser', e.target.value)} 
            placeholder="Administrator"
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
