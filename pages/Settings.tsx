
import React, { useState, useEffect } from 'react';
import { Save, Server, Shield, AlertTriangle, Zap, Terminal, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { AppSettings } from '../types';

const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Connection Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    fetch('/api/settings', { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error("Failed to load settings", err);
        // Set default settings if fetch fails
        setSettings({
          racPath: 'C:\\Program Files\\1cv8\\8.3.22.1709\\bin\\rac.exe',
          rasHost: 'localhost:1545',
          clusterUser: '',
          clusterPass: '',
          checkInterval: 30,
          killMode: true
        });
        setLoading(false);
      });
    
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleChange = (field: keyof AppSettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Настройки успешно сохранены');
      } else {
        alert('Ошибка сохранения');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings) return;
    setTestingConnection(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings) // Send current form data
      });
      
      // Check if response is ok and has content
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      // Check if response has content
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Пустой ответ от сервера');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Неверный формат ответа: ${text.substring(0, 100)}`);
      }
      
      if (data.success) {
        setTestResult({ 
            success: true, 
            message: `Соединение установлено!\nOutput:\n${data.output || 'Команда выполнена успешно'}` 
        });
      } else {
        setTestResult({ 
            success: false, 
            message: `Ошибка выполнения:\n${data.error || 'Неизвестная ошибка'}` 
        });
      }
    } catch (e: any) {
      const errorMessage = e.message || 'Неизвестная ошибка сети';
      setTestResult({ 
        success: false, 
        message: `Ошибка соединения:\n${errorMessage}` 
      });
    } finally {
      setTestingConnection(false);
    }
  };


  if (loading || !settings) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Настройки системы</h1>
        <p className="text-slate-500">Конфигурация подключения к RAS (Remote Administration Server)</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Секция 1: Подключение к RAS */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Server size={24} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Сервер администрирования (RAS)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Хост (RAS)</label>
              <input 
                type="text" 
                value={settings.rasHost}
                onChange={(e) => handleChange('rasHost', e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
              <p className="text-xs text-slate-400">Обычно localhost:1545</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Интервал проверки (сек)</label>
              <input 
                type="number" 
                value={settings.checkInterval}
                onChange={(e) => handleChange('checkInterval', parseInt(e.target.value))}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
              <p className="text-xs text-slate-400">Как часто опрашивать сервер 1С</p>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                <Terminal size={14} />
                Путь к утилите rac.exe
              </label>
              <input 
                type="text" 
                value={settings.racPath}
                onChange={(e) => handleChange('racPath', e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm" 
              />
              <p className="text-xs text-slate-400">Необходим полный путь к исполняемому файлу консоли администрирования</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Администратор кластера</label>
              <input 
                type="text" 
                value={settings.clusterUser}
                onChange={(e) => handleChange('clusterUser', e.target.value)}
                placeholder="Administrator" 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Пароль администратора</label>
              <input 
                type="password" 
                value={settings.clusterPass}
                onChange={(e) => handleChange('clusterPass', e.target.value)}
                placeholder="••••••••" 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
          </div>

          {/* Connection Test Block */}
          <div className="mt-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-sm font-semibold text-slate-700">Статус подключения к 1С</h3>
                 <button 
                   onClick={handleTestConnection}
                   disabled={testingConnection}
                   className="text-xs bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-2"
                 >
                   {testingConnection ? <Loader2 className="animate-spin" size={12}/> : <Terminal size={12}/>}
                   Проверить соединение
                 </button>
             </div>
             
             {testResult && (
                 <div className={`text-xs font-mono p-3 rounded border overflow-x-auto whitespace-pre-wrap ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-2 mb-1 font-bold">
                        {testResult.success ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                        {testResult.success ? 'УСПЕХ (SUCCESS)' : 'ОШИБКА (ERROR)'}
                    </div>
                    {testResult.message}
                 </div>
             )}
             {!testResult && !testingConnection && (
                 <div className="text-xs text-slate-400 italic">
                     Нажмите кнопку, чтобы проверить, видит ли программа кластер 1С.
                 </div>
             )}
          </div>
        </div>

        {/* Секция 2: Активный контроль (Kill Mode) */}
        <div className={`p-6 border-b border-slate-200 transition-colors ${settings.killMode ? 'bg-red-50/50' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${settings.killMode ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Политика ограничений
                  {settings.killMode && <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">Активна</span>}
                </h2>
                <p className="text-xs text-slate-500">Правила обработки превышения лимитов сеансов</p>
              </div>
            </div>
            {settings.killMode && (
               <div className="flex items-center gap-1 text-green-700 bg-green-100 px-3 py-1 rounded-full text-xs font-medium">
                 <CheckCircle2 size={14} />
                 Рекомендуемый режим
               </div>
            )}
          </div>

          <div className="flex items-start justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex gap-4">
              <div className={`mt-1 p-1.5 rounded-full ${settings.killMode ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                <Zap size={20} />
              </div>
              <div>
                <span className="block text-base font-medium text-slate-800">
                  Жесткая блокировка (Kill Mode)
                </span>
                <p className="text-sm text-slate-500 mt-1 max-w-xl">
                  Если включено (по умолчанию), система автоматически завершает сеансы сверх лимита.
                  <br/>
                  Алгоритм: <b>Last In, First Out</b>. При лимите 10, 11-й подключившийся пользователь будет отключен немедленно.
                  <br/>
                  <span className="text-orange-600 font-medium text-xs flex items-center gap-1 mt-2">
                    <AlertTriangle size={12} />
                    Отключайте этот режим только для технического обслуживания.
                  </span>
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-2">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.killMode}
                onChange={(e) => handleChange('killMode', e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        
        <div className="p-6 bg-slate-50 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg shadow-md transition-all font-medium disabled:opacity-70"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
