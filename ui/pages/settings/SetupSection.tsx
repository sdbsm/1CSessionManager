import React, { useState, useEffect } from 'react';
import { Database, Save, RefreshCw, KeyRound, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { getApiKey } from '../../services/apiClient';

export const SetupSection: React.FC = () => {
  const {
    dbEndpointStatus, sqlLoginStatus, apiKeyStatus, licensesStatus, licensesTotal: initialLicensesTotal, dbConfig,
    loadStatuses, saveDbEndpoint, saveSqlLogin, testSqlLogin, saveLicenses, saveApiKey
  } = useSetupStatus();

  // DB State
  const [dbServer, setDbServer] = useState('');
  const [dbDatabase, setDbDatabase] = useState('');
  const [dbTrust, setDbTrust] = useState(true);
  const [dbEncrypt, setDbEncrypt] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [dbMsg, setDbMsg] = useState<string | null>(null);

  // SQL State
  const [sqlUser, setSqlUser] = useState('');
  const [sqlPass, setSqlPass] = useState('');
  const [savingSql, setSavingSql] = useState(false);
  const [testingSql, setTestingSql] = useState(false);
  const [sqlMsg, setSqlMsg] = useState<string | null>(null);

  // Licenses State
  const [licTotal, setLicTotal] = useState(0);
  const [savingLic, setSavingLic] = useState(false);
  const [licMsg, setLicMsg] = useState<string | null>(null);

  // API Key State
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey() || '');
  const [savingKey, setSavingKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  useEffect(() => {
    if (dbConfig.server) {
        setDbServer(dbConfig.server);
        setDbDatabase(dbConfig.database);
        setDbTrust(dbConfig.trust);
        setDbEncrypt(dbConfig.encrypt);
    }
  }, [dbConfig]);

  useEffect(() => {
    setLicTotal(initialLicensesTotal || 0);
  }, [initialLicensesTotal]);

  const handleSaveDb = async () => {
    setSavingDb(true);
    setDbMsg(null);
    const res = await saveDbEndpoint(dbServer, dbDatabase, dbTrust, dbEncrypt);
    if (res.success) setDbMsg('OK: DB endpoint сохранён.');
    else setDbMsg(`Ошибка: ${res.error}`);
    setSavingDb(false);
  };

  const handleSaveSql = async () => {
    setSavingSql(true);
    setSqlMsg(null);
    const res = await saveSqlLogin(sqlUser, sqlPass);
    if (res.success) {
        setSqlMsg('OK: SQL login сохранён.');
        setSqlPass('');
    }
    else setSqlMsg(`Ошибка: ${res.error}`);
    setSavingSql(false);
  };

  const handleTestSql = async () => {
    setTestingSql(true);
    setSqlMsg(null);
    const res = await testSqlLogin();
    if (res.success) setSqlMsg(`OK: Подключение работает. ${res.version}`);
    else setSqlMsg(`Ошибка: ${res.error}`);
    setTestingSql(false);
  };

  const handleSaveLic = async () => {
    setSavingLic(true);
    setLicMsg(null);
    const res = await saveLicenses(licTotal);
    if (res.success) setLicMsg('OK: Лицензии сохранены.');
    else setLicMsg(`Ошибка: ${res.error}`);
    setSavingLic(false);
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    setKeyMsg(null);
    const res = await saveApiKey(apiKeyInput);
    if (res.success) setKeyMsg('OK: API key сохранён.');
    else setKeyMsg(`Ошибка: ${res.error}`);
    setSavingKey(false);
  };

  const SetupStatusPill = ({ label, status }: { label: string; status: 'unknown' | 'set' | 'not_set' }) => {
    const variant = status === 'set' ? 'success' : status === 'not_set' ? 'warning' : 'neutral';
    const text = status === 'set' ? 'OK' : status === 'not_set' ? 'REQUIRED' : 'UNKNOWN';
    return <Badge variant={variant} size="sm">{label} · {text}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* MSSQL Section */}
      <Card>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-200 rounded-lg ring-1 ring-purple-500/20">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-50">MSSQL (подключение)</h2>
              <p className="text-xs text-slate-400">
                Сервер/БД и SQL login хранятся в Windows Credential Manager. Настройка только с localhost.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <SetupStatusPill label="DB" status={dbEndpointStatus} />
            <SetupStatusPill label="SQL" status={sqlLoginStatus} />
          </div>
        </div>

        {/* DB Endpoint Form */}
        <div className="rounded-lg border border-white/10 p-4 bg-white/5 mb-6">
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-slate-200">DB Endpoint Config</span>
                <Button size="sm" variant="secondary" onClick={loadStatuses} icon={<RefreshCw size={12}/>}>Обновить</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="SQL Server" placeholder="localhost" value={dbServer} onChange={e => setDbServer(e.target.value)} />
                <Input label="Database" placeholder="OneCSessionManager" value={dbDatabase} onChange={e => setDbDatabase(e.target.value)} />
            </div>
            <div className="flex gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={dbTrust} onChange={e => setDbTrust(e.target.checked)} /> TrustServerCertificate
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={dbEncrypt} onChange={e => setDbEncrypt(e.target.checked)} /> Encrypt
                </label>
            </div>
            {dbMsg && <p className="mt-2 text-xs text-slate-400">{dbMsg}</p>}
            <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveDb} isLoading={savingDb} icon={<Save size={16}/>}>Сохранить</Button>
            </div>
        </div>

        {/* SQL Login Form */}
        <div className="rounded-lg border border-white/10 p-4 bg-white/5">
             <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-slate-200">SQL Login</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="User" value={sqlUser} onChange={e => setSqlUser(e.target.value)} />
                <Input label="Password" type="password" value={sqlPass} onChange={e => setSqlPass(e.target.value)} />
            </div>
            {sqlMsg && <p className="mt-2 text-xs text-slate-400">{sqlMsg}</p>}
            <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={handleTestSql} isLoading={testingSql} icon={<Database size={16}/>}>Проверить</Button>
                <Button onClick={handleSaveSql} isLoading={savingSql} icon={<Save size={16}/>}>Сохранить</Button>
            </div>
        </div>
      </Card>

      {/* Licenses Section */}
      <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 text-indigo-200 rounded-lg ring-1 ring-indigo-500/20">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Лицензии (на сервере)</h2>
              <p className="text-xs text-slate-400">Используется для расчёта загрузки в «Обзоре».</p>
            </div>
            <div className="ml-auto">
                <SetupStatusPill label="Licenses" status={licensesStatus} />
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1">
                <Input 
                    label="Всего лицензий" 
                    type="number" 
                    min="0"
                    value={licTotal} 
                    onChange={e => setLicTotal(parseInt(e.target.value) || 0)} 
                />
                <p className="text-xs text-slate-400 mt-1">0 = не использовать (считать по лимитам клиентов).</p>
            </div>
            <Button onClick={handleSaveLic} isLoading={savingLic} icon={<Save size={16}/>}>Сохранить</Button>
          </div>
          {licMsg && <p className="mt-2 text-xs text-slate-400">{licMsg}</p>}
      </Card>

      {/* API Key Section */}
      <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 text-amber-200 rounded-lg">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-50">API key (доступ по сети)</h2>
              <p className="text-xs text-slate-400">Для localhost не требуется.</p>
            </div>
            <div className="ml-auto">
                <SetupStatusPill label="API Key" status={apiKeyStatus} />
            </div>
          </div>
          <div className="flex items-end gap-4">
             <div className="flex-1">
                <Input 
                    label="API Key" 
                    type="password"
                    value={apiKeyInput} 
                    onChange={e => setApiKeyInput(e.target.value)} 
                    placeholder="Минимум 16 символов"
                />
             </div>
             <Button 
                variant="secondary"
                onClick={() => {
                    const bytes = new Uint8Array(32);
                    crypto.getRandomValues(bytes);
                    const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
                    setApiKeyInput(b64);
                }}
             >
                Сгенерировать
             </Button>
             <Button onClick={handleSaveKey} isLoading={savingKey} icon={<Save size={16}/>}>Сохранить</Button>
          </div>
          {keyMsg && <p className="mt-2 text-xs text-slate-400">{keyMsg}</p>}
      </Card>
    </div>
  );
};
