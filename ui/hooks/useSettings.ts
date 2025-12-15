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

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    
    (async () => {
      try {
        // 1. Get default agent ID
        const def = await apiFetchJson<{agentId: string}>('/api/_internal/default-agent');
        if (!def.agentId) throw new Error('No agent found');
        if (alive) setAgentId(def.agentId);

        // 2. Get settings for this agent
        const data = await apiFetchJson<LegacySettingsResponse>(`/api/agent/settings?agentId=${def.agentId}`, { signal: controller.signal });

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
      } catch (err) {
        if (!alive) return;
        console.error('Failed to load settings', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    
    return () => {
      alive = false;
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

  return { settings, loading, saving, saveSettings, testConnection, setSettings, agentId };
}
