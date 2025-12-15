import React from 'react';
import { Shield, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Switch } from '../../components/ui/Switch';
import { Button } from '../../components/ui/Button';
import { AppSettings } from '../../types';

interface PolicySectionProps {
  settings: AppSettings;
  onChange: (field: keyof AppSettings, value: any) => void;
  onSave: () => void;
  saving: boolean;
}

export const PolicySection: React.FC<PolicySectionProps> = ({
  settings,
  onChange,
  onSave,
  saving
}) => {
  return (
    <Card className={`transition-colors ${settings.killMode ? 'bg-rose-500/5' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${settings.killMode ? 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20' : 'bg-white/5 text-slate-200 ring-1 ring-white/10'}`}>
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
              Политика ограничений
              {settings.killMode && <span className="text-xs bg-rose-500/15 text-rose-200 px-2 py-0.5 rounded-full ring-1 ring-rose-500/20">Активна</span>}
            </h2>
            <p className="text-xs text-slate-400">Что делать при превышении лимитов сеансов</p>
          </div>
        </div>
        {settings.killMode && (
          <div className="flex items-center gap-1 text-emerald-200 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-medium ring-1 ring-emerald-500/20">
            <CheckCircle2 size={14} />
            Рекомендуемый режим
          </div>
        )}
      </div>

      <div className="flex items-start justify-between p-4 bg-white/5 border border-white/10 rounded-lg shadow-sm">
        <div className="flex gap-4">
          <div className={`mt-1 p-1.5 rounded-full ${settings.killMode ? 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20' : 'bg-white/5 text-slate-300 ring-1 ring-white/10'}`}>
            <Zap size={20} />
          </div>
          <div>
            <span className="block text-base font-medium text-slate-50">
              Жесткая блокировка (Kill Mode)
            </span>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Если включено, система автоматически завершает сеансы сверх лимита (LIFO).
              <br/>
              Отключайте режим только для обслуживания.
              <br/>
              <span className="text-amber-200 font-medium text-xs flex items-center gap-1 mt-2">
                <AlertTriangle size={12} />
                Важно: изменение влияет на поведение “в проде”
              </span>
            </p>
          </div>
        </div>
        <div className="mt-2">
            <Switch 
                checked={settings.killMode} 
                onChange={(v) => onChange('killMode', v)} 
            />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onSave} isLoading={saving}>Сохранить политику</Button>
      </div>
    </Card>
  );
};
