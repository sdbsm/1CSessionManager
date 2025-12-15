
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface ClientDatabase {
  name: string;
  activeSessions: number;
}

export interface Client {
  id: string;
  name: string;
  // contactEmail removed
  maxSessions: number;
  databases: ClientDatabase[]; // Array of DB objects instead of strings
  activeSessions: number; // Total aggregated sessions
  status: 'active' | 'blocked' | 'warning';
}

export interface SystemEvent {
  id: string;
  /**
   * UTC timestamp in ISO-8601 format (recommended for sorting/filtering).
   * Example: 2025-12-14T18:22:12.123Z
   */
  timestampUtc?: string;
  /**
   * Human-friendly local timestamp formatted by backend (ru-RU).
   * Example: 14.12.2025, 21:22:12
   */
  timestampLocal?: string;
  /**
   * Backward-compat field (older API used `timestamp`).
   * New API may omit it; UI should prefer `timestampUtc`/`timestampLocal`.
   */
  timestamp?: string;
  level: AlertLevel;
  message: string;
  clientId?: string;
  clientName?: string;
  databaseName?: string;
  sessionId?: string;
  userName?: string;
}

export interface AppSettings {
  racPath: string;
  rasHost: string;
  clusterUser: string;
  clusterPass: string;
  checkInterval: number;
  killMode: boolean;
  defaultOneCVersion?: string;
  installedVersionsJson?: string;
  publications?: AgentPublicationDto[];
}

export interface AgentPublicationDto {
  id: string;
  siteName: string;
  appPath: string;
  physicalPath: string;
  version: string | null;
  lastDetectedAtUtc: string;
}
