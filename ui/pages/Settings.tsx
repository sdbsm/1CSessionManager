
import React, { useState, useEffect } from 'react';
import { Save, Server, Shield, AlertTriangle, Zap, Terminal, CheckCircle2, Loader2, XCircle, Database, KeyRound, RefreshCw } from 'lucide-react';
import { AppSettings } from '../types';
import { apiFetch, apiFetchJson, getApiKey, setApiKey } from '../services/apiClient';

const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Track which passwords were encrypted (to handle '***ENCRYPTED***' placeholder)
  const [encryptedPasswords, setEncryptedPasswords] = useState<{
    clusterPass: boolean;
    mssqlPassword: boolean;
  }>({ clusterPass: false, mssqlPassword: false });
  
  // Connection Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  
  // MSSQL Connection Test State
  const [testingMssqlConnection, setTestingMssqlConnection] = useState(false);
  const [testMssqlResult, setTestMssqlResult] = useState<{success: boolean; message: string} | null>(null);

  // Centralized setup: SQL login (Credential Manager) + API key
  const [dbEndpointStatus, setDbEndpointStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [dbServer, setDbServer] = useState('');
  const [dbDatabase, setDbDatabase] = useState('');
  const [dbTrustServerCertificate, setDbTrustServerCertificate] = useState(true);
  const [dbEncrypt, setDbEncrypt] = useState(false);
  const [savingDbEndpoint, setSavingDbEndpoint] = useState(false);
  const [dbEndpointMsg, setDbEndpointMsg] = useState<string | null>(null);

  const [sqlLoginStatus, setSqlLoginStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [sqlUser, setSqlUser] = useState('');
  const [sqlPass, setSqlPass] = useState('');
  const [savingSql, setSavingSql] = useState(false);
  const [sqlMsg, setSqlMsg] = useState<string | null>(null);
  const [testingSql, setTestingSql] = useState(false);
  const [sqlTestMsg, setSqlTestMsg] = useState<string | null>(null);

  const [apiKeyStatus, setApiKeyStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey() || '');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyMsg, setApiKeyMsg] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    apiFetch('/api/settings', { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Track which passwords are encrypted (marked as '***ENCRYPTED***')
        setEncryptedPasswords({
          clusterPass: data.clusterPass === '***ENCRYPTED***',
          mssqlPassword: data.mssqlPassword === '***ENCRYPTED***'
        });
        
        // Replace encrypted placeholders with empty strings for display
        const displaySettings = {
          ...data,
          clusterPass: data.clusterPass === '***ENCRYPTED***' ? '' : (data.clusterPass || ''),
          mssqlPassword: data.mssqlPassword === '***ENCRYPTED***' ? '' : (data.mssqlPassword || '')
        };
        
        setSettings(displaySettings);
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

  // Load centralized statuses
  useEffect(() => {
    const load = async () => {
      try {
        const db = await apiFetchJson<{ isSet: boolean; value?: { server: string; database: string; trustServerCertificate: boolean; encrypt: boolean } }>('/api/setup/db/status', { skipAuthHeader: true });
        setDbEndpointStatus(db.isSet ? 'set' : 'not_set');
        if (db.value) {
          setDbServer(db.value.server || '');
          setDbDatabase(db.value.database || '');
          setDbTrustServerCertificate(!!db.value.trustServerCertificate);
          setDbEncrypt(!!db.value.encrypt);
        }
      } catch {
        setDbEndpointStatus('unknown');
      }

      try {
        const sql = await apiFetchJson<{ isSet: boolean }>('/api/setup/sql/status', { skipAuthHeader: true });
        setSqlLoginStatus(sql.isSet ? 'set' : 'not_set');
      } catch {
        setSqlLoginStatus('unknown');
      }

      try {
        const st = await apiFetchJson<{ isSet: boolean }>('/api/admin/apikey/status', { skipAuthHeader: true });
        setApiKeyStatus(st.isSet ? 'set' : 'not_set');
      } catch {
        setApiKeyStatus('unknown');
      }
    };
    load();
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
      // Prepare settings for saving - handle password encryption
      const settingsToSave = { ...settings };
      
      // If password field is empty and was encrypted before, send '***ENCRYPTED***' to keep existing encrypted password
      if (!settingsToSave.clusterPass || settingsToSave.clusterPass.trim() === '') {
        if (encryptedPasswords.clusterPass) {
          settingsToSave.clusterPass = '***ENCRYPTED***';
        }
      }
      
      if (!settingsToSave.mssqlPassword || settingsToSave.mssqlPassword.trim() === '') {
        if (encryptedPasswords.mssqlPassword) {
          settingsToSave.mssqlPassword = '***ENCRYPTED***';
        }
      }
      
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      });
      
      if (res.ok) {
        const savedData = await res.json();
        // Update encrypted passwords tracking
        setEncryptedPasswords({
          clusterPass: savedData.clusterPass === '***ENCRYPTED***',
          mssqlPassword: savedData.mssqlPassword === '***ENCRYPTED***'
        });
        
        // Update settings with saved data (replace encrypted placeholders)
        const displaySettings = {
          ...savedData,
          clusterPass: savedData.clusterPass === '***ENCRYPTED***' ? '' : (savedData.clusterPass || ''),
          mssqlPassword: savedData.mssqlPassword === '***ENCRYPTED***' ? '' : (savedData.mssqlPassword || '')
        };
        setSettings(displaySettings);
        
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
      const res = await apiFetch('/api/test-connection', {
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

  const handleTestMssqlConnection = async () => {
    // Deprecated in new architecture (SQL login configured via Credential Manager).
    // Keep button hidden below (we keep this handler to avoid big refactor).
    if (!settings) return;
    setTestingMssqlConnection(true);
    setTestMssqlResult(null);
    
    try {
      const res = await apiFetch('/api/test-mssql-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
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
        setTestMssqlResult({ 
            success: true, 
            message: `Соединение с MSSQL установлено!\n${data.message || ''}` 
        });
      } else {
        setTestMssqlResult({ 
            success: false, 
            message: `${data.error || 'Неизвестная ошибка'}` 
        });
      }
    } catch (e: any) {
      const errorMessage = e.message || 'Неизвестная ошибка сети';
      setTestMssqlResult({ 
        success: false, 
        message: `Ошибка соединения:\n${errorMessage}` 
      });
    } finally {
      setTestingMssqlConnection(false);
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

      {/* Centralized setup: SQL login + API key */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">MSSQL (подключение)</h2>
              <p className="text-xs text-slate-500">
                Сервер/БД и SQL login хранятся в Windows Credential Manager (не в файлах). Настройка доступна только с localhost.
              </p>
            </div>
          </div>

          {/* DB endpoint */}
          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-700">
                Статус DB endpoint: <b>
                  {dbEndpointStatus === 'set' ? 'Установлен' : dbEndpointStatus === 'not_set' ? 'Не установлен' : 'Неизвестно'}
                </b>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const db = await apiFetchJson<{ isSet: boolean; value?: { server: string; database: string; trustServerCertificate: boolean; encrypt: boolean } }>('/api/setup/db/status', { skipAuthHeader: true });
                    setDbEndpointStatus(db.isSet ? 'set' : 'not_set');
                    if (db.value) {
                      setDbServer(db.value.server || '');
                      setDbDatabase(db.value.database || '');
                      setDbTrustServerCertificate(!!db.value.trustServerCertificate);
                      setDbEncrypt(!!db.value.encrypt);
                    }
                  } catch {
                    setDbEndpointStatus('unknown');
                  }
                }}
                className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-2"
              >
                <RefreshCw size={12} />
                Обновить
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">SQL Server</label>
                <input
                  type="text"
                  value={dbServer}
                  onChange={(e) => setDbServer(e.target.value)}
                  placeholder="localhost или HOST\\INSTANCE"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Database</label>
                <input
                  type="text"
                  value={dbDatabase}
                  onChange={(e) => setDbDatabase(e.target.value)}
                  placeholder="OneCSessionManager"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 mt-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={dbTrustServerCertificate} onChange={(e) => setDbTrustServerCertificate(e.target.checked)} />
                TrustServerCertificate
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={dbEncrypt} onChange={(e) => setDbEncrypt(e.target.checked)} />
                Encrypt
              </label>
            </div>

            {dbEndpointMsg && (
              <div className="mt-3 text-xs whitespace-pre-wrap text-slate-600">{dbEndpointMsg}</div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={savingDbEndpoint}
                onClick={async () => {
                  setSavingDbEndpoint(true);
                  setDbEndpointMsg(null);
                  try {
                    const res = await apiFetch('/api/setup/db', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        server: dbServer,
                        database: dbDatabase,
                        trustServerCertificate: dbTrustServerCertificate,
                        encrypt: dbEncrypt
                      }),
                      skipAuthHeader: true
                    });
                    const txt = await res.text();
                    if (res.ok) {
                      setDbEndpointMsg('OK: DB endpoint сохранён.');
                      setDbEndpointStatus('set');
                    } else {
                      setDbEndpointMsg(`Ошибка: ${txt}`);
                    }
                  } catch (e: any) {
                    setDbEndpointMsg(`Ошибка: ${e.message || e}`);
                  } finally {
                    setSavingDbEndpoint(false);
                  }
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg shadow-md transition-all font-medium disabled:opacity-70"
              >
                {savingDbEndpoint ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {savingDbEndpoint ? 'Сохранение...' : 'Сохранить Server/Database'}
              </button>
            </div>
          </div>

          {/* SQL login */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-700">
              Статус SQL login: <b>
                {sqlLoginStatus === 'set' ? 'Установлен' : sqlLoginStatus === 'not_set' ? 'Не установлен' : 'Неизвестно'}
              </b>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const sql = await apiFetchJson<{ isSet: boolean }>('/api/setup/sql/status', { skipAuthHeader: true });
                    setSqlLoginStatus(sql.isSet ? 'set' : 'not_set');
                  } catch {
                    setSqlLoginStatus('unknown');
                  }
                }}
                className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-2"
              >
                <RefreshCw size={12} />
                Обновить
              </button>

              <button
                type="button"
                disabled={testingSql}
                onClick={async () => {
                  setTestingSql(true);
                  setSqlTestMsg(null);
                  try {
                    const res = await apiFetch('/api/setup/sql/test', { method: 'POST', skipAuthHeader: true });
                    const dataText = await res.text();
                    try {
                      const data = JSON.parse(dataText);
                      if (data.success) {
                        setSqlTestMsg(`OK: подключение к MSSQL работает.\n${data.version || ''}`);
                      } else {
                        setSqlTestMsg(`Ошибка подключения: ${data.error || 'Unknown error'}`);
                      }
                    } catch {
                      setSqlTestMsg(`Неверный ответ: ${dataText.substring(0, 200)}`);
                    }
                  } catch (e: any) {
                    setSqlTestMsg(`Ошибка: ${e.message || e}`);
                  } finally {
                    setTestingSql(false);
                  }
                }}
                className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {testingSql ? <Loader2 className="animate-spin" size={12} /> : <Database size={12} />}
                Проверить
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">SQL user</label>
              <input
                type="text"
                value={sqlUser}
                onChange={(e) => setSqlUser(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">SQL password</label>
              <input
                type="password"
                value={sqlPass}
                onChange={(e) => setSqlPass(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {sqlMsg && (
            <div className="mt-4 text-xs whitespace-pre-wrap text-slate-600">{sqlMsg}</div>
          )}
          {sqlTestMsg && (
            <div className="mt-2 text-xs whitespace-pre-wrap text-slate-600">{sqlTestMsg}</div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              disabled={savingSql}
              onClick={async () => {
                setSavingSql(true);
                setSqlMsg(null);
                try {
                  const res = await apiFetch('/api/setup/sql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: sqlUser, password: sqlPass }),
                    skipAuthHeader: true
                  });
                  const txt = await res.text();
                  if (res.ok) {
                    setSqlPass('');
                    setSqlMsg('OK: SQL login сохранён.');
                    setSqlLoginStatus('set');
                  } else {
                    setSqlMsg(`Ошибка: ${txt}`);
                  }
                } catch (e: any) {
                  setSqlMsg(`Ошибка: ${e.message || e}`);
                } finally {
                  setSavingSql(false);
                }
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg shadow-md transition-all font-medium disabled:opacity-70"
            >
              {savingSql ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {savingSql ? 'Сохранение...' : 'Сохранить SQL login'}
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">API key (для доступа по IP)</h2>
              <p className="text-xs text-slate-500">Минимальная защита API. Для localhost не требуется, для доступа по сети — рекомендуется.</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-700">
              Статус: <b>
                {apiKeyStatus === 'set' ? 'Установлен' : apiKeyStatus === 'not_set' ? 'Не установлен' : 'Неизвестно'}
              </b>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const st = await apiFetchJson<{ isSet: boolean }>('/api/admin/apikey/status', { skipAuthHeader: true });
                  setApiKeyStatus(st.isSet ? 'set' : 'not_set');
                } catch {
                  setApiKeyStatus('unknown');
                }
              }}
              className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-2"
            >
              <RefreshCw size={12} />
              Обновить
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">API key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Минимум 16 символов"
              />
              <p className="text-xs text-slate-400 mt-1">Сохраняется в localStorage браузера и используется в запросах как X-Api-Key.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const bytes = new Uint8Array(32);
                crypto.getRandomValues(bytes);
                const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
                setApiKeyInput(b64);
              }}
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg transition-colors"
            >
              Сгенерировать
            </button>
          </div>

          {apiKeyMsg && (
            <div className="mt-4 text-xs whitespace-pre-wrap text-slate-600">{apiKeyMsg}</div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={savingApiKey}
              onClick={async () => {
                setSavingApiKey(true);
                setApiKeyMsg(null);
                try {
                  const res = await apiFetch('/api/admin/apikey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: apiKeyInput }),
                    skipAuthHeader: false
                  });
                  const txt = await res.text();
                  if (res.ok) {
                    setApiKey(apiKeyInput);
                    setApiKeyMsg('OK: API key сохранён и записан в localStorage.');
                    setApiKeyStatus('set');
                  } else {
                    setApiKeyMsg(`Ошибка: ${txt}`);
                  }
                } catch (e: any) {
                  setApiKeyMsg(`Ошибка: ${e.message || e}`);
                } finally {
                  setSavingApiKey(false);
                }
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg shadow-md transition-all font-medium disabled:opacity-70"
            >
              {savingApiKey ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {savingApiKey ? 'Сохранение...' : 'Сохранить API key'}
            </button>
          </div>
        </div>
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

        {/* Секция 2: Интеграция с MSSQL */}
        <div className="p-6 border-b border-slate-200 hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Database size={24} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Интеграция с MSSQL</h2>
          </div>
          
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.mssqlEnabled || false}
                onChange={(e) => handleChange('mssqlEnabled', e.target.checked)}
                className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Включить интеграцию с MSSQL для получения размеров баз данных
              </span>
            </label>
            <p className="text-xs text-slate-400 ml-8 mt-1">
              Позволяет отображать размеры баз данных 1С на дашборде
            </p>
          </div>

          {settings.mssqlEnabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Сервер MSSQL</label>
                  <input 
                    type="text" 
                    value={settings.mssqlServer || ''}
                    onChange={(e) => handleChange('mssqlServer', e.target.value)}
                    placeholder="localhost"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                  <p className="text-xs text-slate-400">Адрес сервера SQL Server</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Порт</label>
                  <input 
                    type="number" 
                    value={settings.mssqlPort || 1433}
                    onChange={(e) => handleChange('mssqlPort', parseInt(e.target.value) || 1433)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                  <p className="text-xs text-slate-400">Порт SQL Server (по умолчанию 1433)</p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">База данных для подключения</label>
                  <input 
                    type="text" 
                    value={settings.mssqlDatabase || 'master'}
                    onChange={(e) => handleChange('mssqlDatabase', e.target.value)}
                    placeholder="master"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                  <p className="text-xs text-slate-400">Обычно 'master' или 'msdb'</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Пользователь SQL Server</label>
                  <input 
                    type="text" 
                    value={settings.mssqlUser || ''}
                    onChange={(e) => handleChange('mssqlUser', e.target.value)}
                    placeholder="sa"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Пароль</label>
                  <input 
                    type="password" 
                    value={settings.mssqlPassword || ''}
                    onChange={(e) => handleChange('mssqlPassword', e.target.value)}
                    placeholder="••••••••" 
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
              </div>

              {/* MSSQL Connection Test Block */}
              <div className="mt-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
                 <div className="flex justify-between items-center mb-2">
                     <h3 className="text-sm font-semibold text-slate-700">Статус подключения к MSSQL</h3>
                     <button 
                       onClick={handleTestMssqlConnection}
                       disabled={testingMssqlConnection}
                       className="text-xs bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-2"
                     >
                       {testingMssqlConnection ? <Loader2 className="animate-spin" size={12}/> : <Database size={12}/>}
                       Проверить соединение
                     </button>
                 </div>
                 
                 {testMssqlResult && (
                     <div className={`text-xs font-mono p-3 rounded border overflow-x-auto whitespace-pre-wrap ${testMssqlResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <div className="flex items-center gap-2 mb-1 font-bold">
                            {testMssqlResult.success ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                            {testMssqlResult.success ? 'УСПЕХ (SUCCESS)' : 'ОШИБКА (ERROR)'}
                        </div>
                        {testMssqlResult.message}
                     </div>
                 )}
                 {!testMssqlResult && !testingMssqlConnection && (
                     <div className="text-xs text-slate-400 italic">
                         Нажмите кнопку, чтобы проверить подключение к SQL Server.
                     </div>
                 )}
              </div>
            </>
          )}
        </div>

        {/* Секция 3: Активный контроль (Kill Mode) */}
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
