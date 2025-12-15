import { useState, useEffect } from 'react';
import { apiFetchJson } from '../services/apiClient';

export interface ServerInfo {
  hostname: string;
  osVersion: string;
}

export function useServerInfo() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const info = await apiFetchJson<ServerInfo>('/api/server/info');
        setServerInfo(info);
      } catch (error) {
        console.error("Failed to fetch server info:", error);
      }
    };
    fetchServerInfo();
  }, []);

  return serverInfo;
}
