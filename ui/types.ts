
export enum ConnectionType {
  RDP = 'RDP',
  THIN_CLIENT = 'ThinClient',
  WEB_CLIENT = 'WebClient'
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface Session {
  id: string;
  userName: string;
  computerName: string;
  startedAt: string;
  appId: string; // e.g., "1CV8C", "Designer"
  isLicenseConsumer: boolean;
  databaseName: string;
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
  timestamp: string;
  level: AlertLevel;
  message: string;
  clientId?: string;
}

export interface AppSettings {
  racPath: string;
  rasHost: string;
  clusterUser: string;
  clusterPass: string;
  checkInterval: number;
  killMode: boolean;
  // Optional future fields
  emailSmtpHost?: string;
  telegramBotToken?: string;
  // MSSQL Integration
  mssqlEnabled?: boolean;
  mssqlServer?: string;
  mssqlPort?: number;
  mssqlDatabase?: string;
  mssqlUser?: string;
  mssqlPassword?: string;
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  trend: 'up' | 'down' | 'stable';
}
