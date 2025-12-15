import { useEffect, useState } from 'react';
import { AppSettings } from '../types';
import { apiFetchJson } from '../services/apiClient';

type LegacySettingsResponse = Partial<AppSettings> & {
  clusterPass?: string | null;
};

type TestConnectionResponse =
  | { success: true; output?: string | null }
  | { success: false; error?: string | null };

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clusterPassIsEncrypted, setClusterPassIsEncrypted] = useState(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); 
    
    (async () => {
      try {
        const data = await apiFetchJson<LegacySettingsResponse>('/api/settings', { signal: controller.signal });

        if (!alive) return;

        const rawPass = data.clusterPass ?? '';
        setClusterPassIsEncrypted(rawPass === '***ENCRYPTED***');

        const displaySettings: AppSettings = {
          racPath: data.racPath ?? 'C:\\Program Files\\1cv8\\8.3.22.1709\\bin\\rac.exe',
          rasHost: data.rasHost ?? 'localhost:1545',
          clusterUser: data.clusterUser ?? '',
          clusterPass: rawPass === '***ENCRYPTED***' ? '' : rawPass,
          checkInterval: typeof data.checkInterval === 'number' ? data.checkInterval : 30,
          killMode: !!data.killMode
        };

        setSettings(displaySettings);
      } catch (err) {
        if (!alive) return;
        console.error('Failed to load settings', err);
        setSettings({
          racPath: 'C:\\Program Files\\1cv8\\8.3.22.1709\\bin\\rac.exe',
          rasHost: 'localhost:1545',
          clusterUser: '',
          clusterPass: '',
          checkInterval: 30,
          killMode: false
        });
        setClusterPassIsEncrypted(false);
      } finally {
        clearTimeout(timeoutId);
        if (alive) setLoading(false);
      }
    })();
    
    return () => {
      alive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const saveSettings = async (newSettings: AppSettings) => {
    if (!newSettings) return false;
    setSaving(true);
    try {
      const settingsToSave = { ...newSettings };
      
      if (!settingsToSave.clusterPass || settingsToSave.clusterPass.trim() === '') {
        if (clusterPassIsEncrypted) {
          settingsToSave.clusterPass = '***ENCRYPTED***';
        }
      }
      
      const savedData = await apiFetchJson<LegacySettingsResponse>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      });
      
      const rawPass = savedData.clusterPass ?? '';
      setClusterPassIsEncrypted(rawPass === '***ENCRYPTED***');

      const displaySettings: AppSettings = {
        racPath: savedData.racPath ?? settingsToSave.racPath,
        rasHost: savedData.rasHost ?? settingsToSave.rasHost,
        clusterUser: savedData.clusterUser ?? settingsToSave.clusterUser,
        clusterPass: rawPass === '***ENCRYPTED***' ? '' : rawPass,
        checkInterval: typeof savedData.checkInterval === 'number' ? savedData.checkInterval : settingsToSave.checkInterval,
        killMode: typeof savedData.killMode === 'boolean' ? savedData.killMode : settingsToSave.killMode
      };

      setSettings(displaySettings);
      return true;
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
    return false;
  };

  const testConnection = async (currentSettings: AppSettings) => {
    try {
      const data = await apiFetchJson<TestConnectionResponse>('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings) 
      });
      
      return data.success
        ? { success: true, message: `Соединение установлено!\nOutput:\n${data.output || 'Команда выполнена успешно'}` }
        : { success: false, message: `Ошибка выполнения:\n${data.error || 'Неизвестная ошибка'}` };
    } catch (e: any) {
      return { success: false, message: `Ошибка соединения:\n${e.message || 'Неизвестная ошибка сети'}` };
    }
  };

  return { settings, loading, saving, saveSettings, testConnection, setSettings };
}
