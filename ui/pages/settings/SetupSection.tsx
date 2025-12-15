import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Database, Save, RefreshCw, KeyRound } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { getApiKey } from '../../services/apiClient';
import { useToast } from '../../hooks/useToast';

export const SetupSection: React.FC = () => {
  const toast = useToast();
  const {
    dbEndpointStatus, sqlLoginStatus, apiKeyStatus, licensesStatus, licensesTotal: initialLicensesTotal, dbConfig,
    loadStatuses, saveDbEndpoint, saveSqlLogin, testSqlLogin, saveLicenses, saveApiKey
  } = useSetupStatus();

  const dbRef = useRef<HTMLDivElement | null>(null);
  const sqlRef = useRef<HTMLDivElement | null>(null);
  const licRef = useRef<HTMLDivElement | null>(null);
  const keyRef = useRef<HTMLDivElement | null>(null);

  // DB State
  const [dbServer, setDbServer] = useState('');
  const [dbDatabase, setDbDatabase] = useState('');
  const [dbTrust, setDbTrust] = useState(true);
  const [dbEncrypt, setDbEncrypt] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [dbMsg, setDbMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [dbErrors, setDbErrors] = useState<{ server?: string; database?: string }>({});

  // SQL State
  const [sqlUser, setSqlUser] = useState('');
  const [sqlPass, setSqlPass] = useState('');
  const [savingSql, setSavingSql] = useState(false);
  const [testingSql, setTestingSql] = useState(false);
  const [sqlMsg, setSqlMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [sqlErrors, setSqlErrors] = useState<{ user?: string; pass?: string }>({});

  // Licenses State
  const [licTotal, setLicTotal] = useState(0);
  const [savingLic, setSavingLic] = useState(false);
  const [licMsg, setLicMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  // API Key State
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey() || '');
  const [savingKey, setSavingKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [keyError, setKeyError] = useState<string | undefined>(undefined);

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
    const nextErrors: { server?: string; database?: string } = {};
    if (!dbServer.trim()) nextErrors.server = 'Укажите сервер (например, localhost).';
    if (!dbDatabase.trim()) nextErrors.database = 'Укажите имя базы (например, OneCSessionManager).';
    setDbErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.warning({ title: 'Проверьте поля', message: 'Не все поля заполнены.' });
      return;
    }

    setSavingDb(true);
    setDbMsg(null);
    const res = await saveDbEndpoint(dbServer, dbDatabase, dbTrust, dbEncrypt);
    if (res.success) {
      setDbMsg({ kind: 'success', text: 'Подключение к SQL сохранено.' });
      toast.success({ title: 'Сохранено', message: 'Подключение к SQL (сервер/база) сохранено.' });
    } else {
      setDbMsg({ kind: 'error', text: `Ошибка: ${res.error}` });
      toast.error({ title: 'Ошибка', message: res.error || 'Не удалось сохранить подключение к SQL.' });
    }
    setSavingDb(false);
  };

  const handleSaveSql = async () => {
    const nextErrors: { user?: string; pass?: string } = {};
    if (!sqlUser.trim()) nextErrors.user = 'Укажите пользователя.';
    if (!sqlPass.trim()) nextErrors.pass = 'Укажите пароль.';
    setSqlErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.warning({ title: 'Проверьте поля', message: 'Логин/пароль не заполнены.' });
      return;
    }

    setSavingSql(true);
    setSqlMsg(null);
    const res = await saveSqlLogin(sqlUser, sqlPass);
    if (res.success) {
        setSqlMsg({ kind: 'success', text: 'SQL учётные данные сохранены.' });
        toast.success({ title: 'Сохранено', message: 'Учетные данные SQL сохранены.' });
        setSqlPass('');
    }
    else {
      setSqlMsg({ kind: 'error', text: `Ошибка: ${res.error}` });
      toast.error({ title: 'Ошибка', message: res.error || 'Не удалось сохранить SQL учётные данные.' });
    }
    setSavingSql(false);
  };

  const handleTestSql = async () => {
    setTestingSql(true);
    setSqlMsg(null);
    const res = await testSqlLogin();
    if (res.success) {
      setSqlMsg({ kind: 'success', text: `Подключение работает. ${res.version}` });
      toast.success({ title: 'SQL: OK', message: res.version || 'Подключение успешно.' });
    } else {
      setSqlMsg({ kind: 'error', text: `Ошибка: ${res.error}` });
      toast.error({ title: 'SQL: ошибка', message: res.error || 'Проверка подключения не удалась.' });
    }
    setTestingSql(false);
  };

  const handleSaveLic = async () => {
    setSavingLic(true);
    setLicMsg(null);
    const res = await saveLicenses(licTotal);
    if (res.success) {
      setLicMsg({ kind: 'success', text: 'Лицензии сохранены.' });
      toast.success({ title: 'Сохранено', message: 'Лимит лицензий обновлён.' });
    } else {
      setLicMsg({ kind: 'error', text: `Ошибка: ${res.error}` });
      toast.error({ title: 'Ошибка', message: res.error || 'Не удалось сохранить лицензии.' });
    }
    setSavingLic(false);
  };

  const handleSaveKey = async () => {
    const v = (apiKeyInput || '').trim();
    if (v.length > 0 && v.length < 16) {
      setKeyError('Минимум 16 символов.');
      toast.warning({ title: 'Слишком короткий ключ', message: 'Сгенерируйте ключ или вставьте ключ длиной ≥ 16.' });
      return;
    }
    setKeyError(undefined);
    setSavingKey(true);
    setKeyMsg(null);
    const res = await saveApiKey(apiKeyInput);
    if (res.success) {
      setKeyMsg({ kind: 'success', text: 'API‑ключ сохранён.' });
      toast.success({ title: 'Сохранено', message: 'API‑ключ сохранён (используется для сетевого доступа).' });
    } else {
      setKeyMsg({ kind: 'error', text: `Ошибка: ${res.error}` });
      toast.error({ title: 'Ошибка', message: res.error || 'Не удалось сохранить API‑ключ.' });
    }
    setSavingKey(false);
  };

  const SetupStatusPill = ({ label, status }: { label: string; status: 'unknown' | 'set' | 'not_set' }) => {
    const variant = status === 'set' ? 'success' : status === 'not_set' ? 'warning' : 'neutral';
    const text = status === 'set' ? 'Готово' : status === 'not_set' ? 'Нужно' : '—';
    return <Badge variant={variant} size="sm">{label} · {text}</Badge>;
  };

  const msgClass = (kind: 'success' | 'error' | 'info') => {
    if (kind === 'success') return 'text-emerald-200';
    if (kind === 'error') return 'text-rose-200';
    return 'text-slate-300';
  };

  const missing = useMemo(() => {
    let n = 0;
    if (dbEndpointStatus === 'not_set') n++;
    if (sqlLoginStatus === 'not_set') n++;
    if (licensesStatus === 'not_set') n++;
    // API key is optional (network only)
    return n;
  }, [dbEndpointStatus, sqlLoginStatus, licensesStatus]);

  return (
    <div className="space-y-6">
      <Card
        title="Setup: быстрый чеклист"
        description="Заполните 1–3 пункта ниже, чтобы «Обзор» и метрики работали предсказуемо."
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {missing === 0 ? 'Setup выглядит готовым.' : `Нужно заполнить: ${missing}`}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={loadStatuses}
              icon={<RefreshCw size={14} />}
              title="Обновить статусы (SQL/ключ/лицензии)"
            >
              Обновить статусы
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Хранилище (SQL): сервер и база</div>
              <div className="text-xs text-slate-400">Нужно для размеров инфобаз и части метрик «Обзора».</div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <SetupStatusPill label="SQL DB" status={dbEndpointStatus} />
              <Button size="sm" variant="secondary" onClick={() => dbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Открыть
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Хранилище (SQL): учётные данные</div>
              <div className="text-xs text-slate-400">Хранится в Windows Credential Manager. Настройка только с localhost.</div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <SetupStatusPill label="SQL Auth" status={sqlLoginStatus} />
              <Button size="sm" variant="secondary" onClick={() => sqlRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Открыть
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Лицензии</div>
              <div className="text-xs text-slate-400">Если 0 — «Обзор» использует лимиты клиентов вместо лицензий.</div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <SetupStatusPill label="Лиц" status={licensesStatus} />
              <Button size="sm" variant="secondary" onClick={() => licRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Открыть
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">API‑ключ (для доступа по сети)</div>
              <div className="text-xs text-slate-400">Для localhost обычно не требуется.</div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <SetupStatusPill label="Ключ" status={apiKeyStatus} />
              <Button size="sm" variant="secondary" onClick={() => keyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Открыть
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* MSSQL Section */}
      <Card title="Хранилище (SQL Server)" description="Сервер/база и SQL‑учётка используются для метрик по инфобазам.">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-200 rounded-lg ring-1 ring-purple-500/20">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Подключение</h2>
              <p className="text-xs text-slate-400">
                Сервер/база и SQL‑учётные данные хранятся в Windows Credential Manager. Настройка только с localhost.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <SetupStatusPill label="SQL DB" status={dbEndpointStatus} />
            <SetupStatusPill label="SQL Auth" status={sqlLoginStatus} />
          </div>
        </div>

        {/* DB Endpoint Form */}
        <div ref={dbRef} className="rounded-lg border border-white/10 p-4 bg-white/5 mb-6">
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-slate-200">SQL Server и база (подключение)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="SQL Server"
                  placeholder="localhost"
                  value={dbServer}
                  onChange={e => { setDbServer(e.target.value); setDbErrors(prev => ({ ...prev, server: undefined })); }}
                  error={dbErrors.server}
                />
                <Input
                  label="Имя базы данных (SQL)"
                  placeholder="OneCSessionManager"
                  value={dbDatabase}
                  onChange={e => { setDbDatabase(e.target.value); setDbErrors(prev => ({ ...prev, database: undefined })); }}
                  error={dbErrors.database}
                />
            </div>
            <div className="flex gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm text-slate-200 select-none">
                    <input
                      className="h-4 w-4 rounded border border-white/20 bg-white/5 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      type="checkbox"
                      checked={dbTrust}
                      onChange={e => setDbTrust(e.target.checked)}
                    />{' '}
                    TrustServerCertificate <span className="text-xs text-slate-500">(доверять сертификату)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200 select-none">
                    <input
                      className="h-4 w-4 rounded border border-white/20 bg-white/5 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      type="checkbox"
                      checked={dbEncrypt}
                      onChange={e => setDbEncrypt(e.target.checked)}
                    />{' '}
                    Encrypt <span className="text-xs text-slate-500">(шифровать соединение)</span>
                </label>
            </div>
            {dbMsg && <p className={`mt-2 text-xs ${msgClass(dbMsg.kind)}`}>{dbMsg.text}</p>}
            <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveDb} isLoading={savingDb} icon={<Save size={16}/>}>Сохранить</Button>
            </div>
        </div>

        {/* SQL Login Form */}
        <div ref={sqlRef} className="rounded-lg border border-white/10 p-4 bg-white/5">
             <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-slate-200">SQL учётные данные</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Пользователь"
                  placeholder="sa / DOMAIN\\user"
                  value={sqlUser}
                  onChange={e => { setSqlUser(e.target.value); setSqlErrors(prev => ({ ...prev, user: undefined })); }}
                  error={sqlErrors.user}
                />
                <Input
                  label="Пароль"
                  type="password"
                  value={sqlPass}
                  onChange={e => { setSqlPass(e.target.value); setSqlErrors(prev => ({ ...prev, pass: undefined })); }}
                  error={sqlErrors.pass}
                />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              “Проверить” тестирует сохранённые учётные данные (не вводимые в полях).
            </p>
            {sqlMsg && <p className={`mt-2 text-xs ${msgClass(sqlMsg.kind)}`}>{sqlMsg.text}</p>}
            <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={handleTestSql}
                  isLoading={testingSql}
                  icon={<Database size={16}/>}
                  disabled={sqlLoginStatus !== 'set'}
                  title={sqlLoginStatus !== 'set' ? 'Сначала сохраните SQL учётные данные' : 'Проверить подключение к SQL'}
                >
                  Проверить
                </Button>
                <Button onClick={handleSaveSql} isLoading={savingSql} icon={<Save size={16}/>}>Сохранить</Button>
            </div>
        </div>
      </Card>

      {/* Licenses Section */}
      <Card title="Лицензии (на сервере)" description="Используется для расчёта загрузки в «Обзоре».">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 text-indigo-200 rounded-lg ring-1 ring-indigo-500/20">
              <KeyRound size={22} />
            </div>
            <div className="ml-auto">
                <SetupStatusPill label="Лиц" status={licensesStatus} />
            </div>
          </div>
          <div ref={licRef} className="flex items-end gap-4">
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
          {licMsg && <p className={`mt-2 text-xs ${msgClass(licMsg.kind)}`}>{licMsg.text}</p>}
      </Card>

      {/* API Key Section */}
      <Card title="API‑ключ (доступ по сети)" description="Для localhost обычно не требуется.">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 text-amber-200 rounded-lg">
              <KeyRound size={22} />
            </div>
            <div className="ml-auto">
                <SetupStatusPill label="Ключ" status={apiKeyStatus} />
            </div>
          </div>
          <div ref={keyRef} className="flex items-end gap-4">
             <div className="flex-1">
                <Input 
                    label="API‑ключ" 
                    type="password"
                    value={apiKeyInput} 
                    onChange={e => setApiKeyInput(e.target.value)} 
                    placeholder="Минимум 16 символов"
                    error={keyError}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Совет: сгенерируйте ключ и сохраните его в безопасном месте (он понадобится клиентам).
                </p>
             </div>
             <Button 
                variant="secondary"
                onClick={() => {
                    const bytes = new Uint8Array(32);
                    crypto.getRandomValues(bytes);
                    const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
                    setApiKeyInput(b64);
                    setKeyError(undefined);
                }}
             >
                Сгенерировать
             </Button>
             <Button onClick={handleSaveKey} isLoading={savingKey} icon={<Save size={16}/>}>Сохранить</Button>
          </div>
          {keyMsg && <p className={`mt-2 text-xs ${msgClass(keyMsg.kind)}`}>{keyMsg.text}</p>}
      </Card>
    </div>
  );
};
