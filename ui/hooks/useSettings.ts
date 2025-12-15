import { useEffect, useState } from 'react';
import { AppSettings } from '../types';
import { apiFetchJson } from '../services/apiClient';

type LegacySettingsResponse = {
  agentId?: string;
  enabled?: boolean;
  racPath?: string;
  rasHost?: string;
  clusterUser?: string;
  pollIntervalSeconds?: number;
  killModeEnabled?: boolean;
  clusterPassIsSet?: boolean;
  defaultOneCVersion?: string;
  installedVersionsJson?: string;
  publications?: any[];
};

type TestConnectionResponse =
  | { success: true; output?: string | null }
  | { success: false; error?: string | null };

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    
    // Add timeout to prevent infinite loading
    let timeoutFired = false;
    const timeoutId = setTimeout(() => {
      if (alive) {
        timeoutFired = true;
        console.warn('Settings loading timeout - setting default values');
        setError('Таймаут загрузки настроек. Проверьте, что сервис Control запущен на http://localhost:5000');
        setSettings({
          racPath: '',
          rasHost: 'localhost:1545',
          clusterUser: '',
          clusterPass: '',
          checkInterval: 30,
          killMode: false,
          defaultOneCVersion: '',
          installedVersionsJson: undefined,
          publications: []
        });
        setLoading(false);
      }
    }, 10000); // 10 second timeout
    
    (async () => {
      try {
        setError(null);
        setLoading(true);
        // 1. Get default agent ID
        const def = await apiFetchJson<{agentId: string | null}>('/api/_internal/default-agent', { 
          signal: controller.signal
        });
        if (!def.agentId) {
          throw new Error('Агент не найден. Убедитесь, что служба Agent запущена и подключена к базе данных.');
        }
        if (alive) setAgentId(def.agentId);

        // 2. Get settings for this agent
        const data = await apiFetchJson<LegacySettingsResponse>(`/api/agent/settings?agentId=${def.agentId}`, { 
          signal: controller.signal,
          skipAuthHeader: false
        });

        if (!alive) return;

        setSettings({
          racPath: data.racPath || '',
          rasHost: data.rasHost || '',
          clusterUser: data.clusterUser || '',
          clusterPass: '', // we don't get password back
          checkInterval: data.pollIntervalSeconds || 30,
          killMode: !!data.killModeEnabled,
          defaultOneCVersion: data.defaultOneCVersion || '',
          installedVersionsJson: data.installedVersionsJson,
          publications: data.publications
        });
        setError(null);
      } catch (err: any) {
        if (!alive) return;
        const errorMessage = err?.message || 'Не удалось загрузить настройки. Проверьте, что сервис Control запущен и доступен на http://localhost:5000';
        console.error('Failed to load settings', err);
        setError(errorMessage);
        // Set default empty settings to allow UI to render
        setSettings({
          racPath: '',
          rasHost: 'localhost:1545',
          clusterUser: '',
          clusterPass: '',
          checkInterval: 30,
          killMode: false,
          defaultOneCVersion: '',
          installedVersionsJson: undefined,
          publications: []
        });
      } finally {
        if (alive && !timeoutFired) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    })();
    
    return () => {
      alive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const saveSettings = async (newSettings: AppSettings) => {
    if (!newSettings || !agentId) return false;
    setSaving(true);
    try {
      const payload: any = {
        racPath: newSettings.racPath,
        rasHost: newSettings.rasHost,
        clusterUser: newSettings.clusterUser,
        pollIntervalSeconds: newSettings.checkInterval,
        killModeEnabled: newSettings.killMode,
        defaultOneCVersion: newSettings.defaultOneCVersion
      };
      
      if (newSettings.clusterPass) {
        payload.clusterPass = newSettings.clusterPass;
      }

      await apiFetchJson('/api/agent/settings?agentId=' + agentId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setSettings({ ...newSettings, clusterPass: '' }); // clear pass after save
      return true;
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
    return false;
  };

  const testConnection = async (currentSettings: AppSettings) => {
    // Test connection endpoint still uses old format or needs update?
    // Let's assume it works with AppSettings structure but we should probably update it to use agentId context if possible.
    // For now, let's map it to what backend expects.
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

  return { settings, loading, saving, saveSettings, testConnection, setSettings, agentId, error };
}
