import { useState, useEffect } from 'react';
import { apiFetchJson, apiFetch, setApiKey as setStoredApiKey } from '../services/apiClient';

export function useSetupStatus() {
  const [dbEndpointStatus, setDbEndpointStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [sqlLoginStatus, setSqlLoginStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [apiKeyStatus, setApiKeyStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [licensesStatus, setLicensesStatus] = useState<'unknown' | 'set' | 'not_set'>('unknown');
  const [licensesTotal, setLicensesTotal] = useState<number>(0);

  const [dbConfig, setDbConfig] = useState<{server: string, database: string, trust: boolean, encrypt: boolean}>({
    server: '', database: '', trust: true, encrypt: false
  });

  const loadStatuses = async () => {
    try {
      const db = await apiFetchJson<{ isSet: boolean; value?: { server: string; database: string; trustServerCertificate: boolean; encrypt: boolean } }>('/api/setup/db/status', { skipAuthHeader: true });
      setDbEndpointStatus(db.isSet ? 'set' : 'not_set');
      if (db.value) {
        setDbConfig({
            server: db.value.server || '',
            database: db.value.database || '',
            trust: !!db.value.trustServerCertificate,
            encrypt: !!db.value.encrypt
        });
      }
    } catch { setDbEndpointStatus('unknown'); }

    try {
      const sql = await apiFetchJson<{ isSet: boolean }>('/api/setup/sql/status', { skipAuthHeader: true });
      setSqlLoginStatus(sql.isSet ? 'set' : 'not_set');
    } catch { setSqlLoginStatus('unknown'); }

    try {
      const st = await apiFetchJson<{ isSet: boolean }>('/api/admin/apikey/status', { skipAuthHeader: true });
      setApiKeyStatus(st.isSet ? 'set' : 'not_set');
    } catch { setApiKeyStatus('unknown'); }

    try {
      const lic = await apiFetchJson<{ isSet: boolean; total?: number | null }>('/api/admin/licenses/status');
      if (lic.isSet && typeof lic.total === 'number') {
        setLicensesStatus('set');
        setLicensesTotal(lic.total);
      } else {
        setLicensesStatus('not_set');
      }
    } catch { setLicensesStatus('unknown'); }
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  const saveDbEndpoint = async (server: string, database: string, trust: boolean, encrypt: boolean) => {
    try {
      const res = await apiFetch('/api/setup/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, database, trustServerCertificate: trust, encrypt }),
        skipAuthHeader: true
      });
      if (res.ok) {
        setDbEndpointStatus('set');
        return { success: true };
      }
      return { success: false, error: await res.text() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const saveSqlLogin = async (userId: string, password: string) => {
    try {
      const res = await apiFetch('/api/setup/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
        skipAuthHeader: true
      });
      if (res.ok) {
        setSqlLoginStatus('set');
        return { success: true };
      }
      return { success: false, error: await res.text() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const testSqlLogin = async () => {
    try {
      const res = await apiFetch('/api/setup/sql/test', { method: 'POST', skipAuthHeader: true });
      const data = await res.json();
      if (data.success) {
        return { success: true, version: data.version };
      }
      return { success: false, error: data.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const saveLicenses = async (total: number) => {
    try {
        const res = await apiFetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total }),
        });
        if (res.ok) {
        setLicensesStatus(total > 0 ? 'set' : 'not_set');
        setLicensesTotal(total);
        return { success: true };
        }
        return { success: false, error: await res.text() };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
  };

  const saveApiKey = async (apiKey: string) => {
    try {
        const res = await apiFetch('/api/admin/apikey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
          skipAuthHeader: false
        });
        if (res.ok) {
          setStoredApiKey(apiKey);
          setApiKeyStatus('set');
          return { success: true };
        }
        return { success: false, error: await res.text() };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
  };

  return {
    dbEndpointStatus,
    sqlLoginStatus,
    apiKeyStatus,
    licensesStatus,
    licensesTotal,
    dbConfig,
    loadStatuses,
    saveDbEndpoint,
    saveSqlLogin,
    testSqlLogin,
    saveLicenses,
    saveApiKey
  };
}
