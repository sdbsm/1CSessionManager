import express from 'express';
import { execFile, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Optional: iconv-lite for correct CP866 decoding (Russian text in console)
let iconv;
try {
    const iconvModule = await import('iconv-lite');
    iconv = iconvModule.default || iconvModule;
} catch (e) {
    console.error("Notice: 'iconv-lite' not installed. Install it for better Cyrillic support.");
}

// MSSQL driver
let mssql;
try {
    const mssqlModule = await import('mssql');
    mssql = mssqlModule.default || mssqlModule;
} catch (e) {
    console.error("Notice: 'mssql' not installed. Install it for MSSQL integration support.");
}

// Encryption service for password protection
let encryptionService;
try {
    const encryptionModule = await import('./services/encryptionService.js');
    encryptionService = encryptionModule;
} catch (e) {
    console.error("Notice: Encryption service not available. Passwords will be stored in plain text.");
    encryptionService = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Note: Static files will be served after API routes to avoid intercepting API requests

// --- CONSTANTS & PATHS ---
const PROGRAM_DATA = process.env.ProgramData || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
const DATA_DIR = path.join(PROGRAM_DATA, '1CSessionManager');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// --- INITIALIZATION ---
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.error("FS Error:", e); }
}

const DEFAULT_SETTINGS = {
    racPath: 'C:\\Program Files\\1cv8\\8.3.22.1709\\bin\\rac.exe',
    rasHost: 'localhost:1545',
    clusterUser: '',
    clusterPass: '',
    checkInterval: 30,
    killMode: true,
    // MSSQL Integration
    mssqlEnabled: false,
    mssqlServer: 'localhost',
    mssqlPort: 1433,
    mssqlDatabase: 'master',
    mssqlUser: '',
    mssqlPassword: ''
};

// --- STATE ---
function loadJSON(filepath, defaultVal) {
    try {
        if (fs.existsSync(filepath)) return JSON.parse(fs.readFileSync(filepath));
    } catch (e) { console.error(`Error loading ${filepath}`, e); }
    return defaultVal;
}

let clients = loadJSON(CLIENTS_FILE, []);
// Load settings and decrypt passwords
let loadedSettings = loadJSON(SETTINGS_FILE, {});
let settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
// Decrypt passwords after loading will happen after decryptSettingsPasswords function is defined
let events = loadJSON(EVENTS_FILE, []);
let dbMap = {}; // UUID -> Name
let clusterId = null;
let isMonitoring = false;

// Dashboard statistics
let dashboardStats = {
    databaseStats: {}, // { dbName: { sessions: number } }
    connectionTypes: { '1CV8': 0, '1CV8C': 0, 'WebClient': 0, 'App': 0 },
    clusterStatus: 'unknown', // 'online' | 'offline' | 'unknown'
    lastUpdate: null
};

// Constants
const MAX_EVENTS_HISTORY = 100; // Maximum number of events to keep in history
const DATABASE_SIZES_CACHE_TTL = 300000; // 5 minutes in milliseconds
const RAC_TIMEOUT = 30000; // 30 seconds timeout for RAC commands
const POWERSHELL_TIMEOUT = 5000; // 5 seconds timeout for PowerShell commands

// MSSQL Database sizes cache
let databaseSizesCache = {
    data: {}, // { dbName: sizeInMB }
    timestamp: null,
    ttl: DATABASE_SIZES_CACHE_TTL
};

function saveData() {
    try {
        fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
        
        // Encrypt passwords before saving settings to file
        const settingsToSave = encryptSettingsPasswords({ ...settings });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2));
        
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(events.slice(0, MAX_EVENTS_HISTORY), null, 2));
    } catch (e) { console.error("Save Error:", e); }
}

function logEvent(level, message) {
    const event = { id: Date.now().toString(), timestamp: new Date().toLocaleString('ru-RU'), level, message };
    events.unshift(event);
    if (events.length > MAX_EVENTS_HISTORY) events.pop();
    saveData();
    console.log(`[${level.toUpperCase()}] ${message}`);
}

// --- PASSWORD ENCRYPTION ---

/**
 * Decrypt passwords in settings object
 * Called after loading settings from file
 * Uses synchronous decryption for startup
 */
function decryptSettingsPasswords(settingsObj) {
    if (!encryptionService || !settingsObj) return settingsObj;
    
    const decrypted = { ...settingsObj };
    
    // Decrypt cluster password (use sync version for startup)
    if (decrypted.clusterPass && typeof encryptionService.isEncrypted === 'function') {
        if (encryptionService.isEncrypted(decrypted.clusterPass)) {
            // Try sync version first (for startup)
            if (typeof encryptionService.decryptPasswordSync === 'function') {
                const decryptedPass = encryptionService.decryptPasswordSync(decrypted.clusterPass);
                if (decryptedPass) {
                    decrypted.clusterPass = decryptedPass;
                }
            }
        }
    }
    
    // Decrypt MSSQL password (use sync version for startup)
    if (decrypted.mssqlPassword && typeof encryptionService.isEncrypted === 'function') {
        if (encryptionService.isEncrypted(decrypted.mssqlPassword)) {
            // Try sync version first (for startup)
            if (typeof encryptionService.decryptPasswordSync === 'function') {
                const decryptedPass = encryptionService.decryptPasswordSync(decrypted.mssqlPassword);
                if (decryptedPass) {
                    decrypted.mssqlPassword = decryptedPass;
                }
            }
        }
    }
    
    return decrypted;
}

/**
 * Encrypt passwords in settings object before saving
 * Also migrates plain text passwords to encrypted format
 * Uses synchronous encryption to avoid async complexity in saveData
 */
function encryptSettingsPasswords(settingsObj) {
    if (!encryptionService || !settingsObj) return settingsObj;
    
    const encrypted = { ...settingsObj };
    
    // Encrypt/migrate cluster password (use sync version)
    if (encrypted.clusterPass && encrypted.clusterPass.trim() !== '') {
        // Check if already encrypted
        if (typeof encryptionService.isEncrypted === 'function' && encryptionService.isEncrypted(encrypted.clusterPass)) {
            // Already encrypted, keep as is
        } else {
            // Need to encrypt - use sync version
            if (typeof encryptionService.encryptPasswordSync === 'function') {
                const encryptedPass = encryptionService.encryptPasswordSync(encrypted.clusterPass);
                if (encryptedPass) {
                    encrypted.clusterPass = encryptedPass;
                }
            }
        }
    }
    
    // Encrypt/migrate MSSQL password (use sync version)
    if (encrypted.mssqlPassword && encrypted.mssqlPassword.trim() !== '') {
        // Check if already encrypted
        if (typeof encryptionService.isEncrypted === 'function' && encryptionService.isEncrypted(encrypted.mssqlPassword)) {
            // Already encrypted, keep as is
        } else {
            // Need to encrypt - use sync version
            if (typeof encryptionService.encryptPasswordSync === 'function') {
                const encryptedPass = encryptionService.encryptPasswordSync(encrypted.mssqlPassword);
                if (encryptedPass) {
                    encrypted.mssqlPassword = encryptedPass;
                }
            }
        }
    }
    
    return encrypted;
}

/**
 * Prepare settings for API response (without decrypted passwords)
 * Returns settings with encrypted passwords for security
 */
function prepareSettingsForResponse(settingsObj) {
    const response = { ...settingsObj };
    
    // Replace passwords with placeholder for security
    if (response.clusterPass && response.clusterPass.trim() !== '') {
        response.clusterPass = '***ENCRYPTED***';
    }
    if (response.mssqlPassword && response.mssqlPassword.trim() !== '') {
        response.mssqlPassword = '***ENCRYPTED***';
    }
    
    return response;
}

// Decrypt passwords after loading settings (now that decryptSettingsPasswords is defined)
settings = decryptSettingsPasswords(settings);

// --- RAC ENGINE ---

/**
 * Executes RAC command. Returns output string on success, NULL on failure.
 * Logs stderr errors to console.
 */
function runRac(args) {
    return new Promise((resolve) => {
        let racPath = settings.racPath.replace(/"/g, '').trim();
        if (!fs.existsSync(racPath)) {
            console.error(`RAC executable not found at: ${racPath}`);
            return resolve(null);
        }

        const fullArgs = [...args, settings.rasHost.trim()];
        
        const options = {
            encoding: 'binary', // Capture raw bytes for iconv
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
            timeout: RAC_TIMEOUT
        };

        execFile(racPath, fullArgs, options, (err, stdout, stderr) => {
            let output = stdout;
            let errorText = stderr;

            if (iconv) {
                try {
                    output = iconv.decode(Buffer.from(stdout, 'binary'), 'cp866');
                    errorText = iconv.decode(Buffer.from(stderr, 'binary'), 'cp866');
                } catch (e) {}
            } else {
                output = stdout.toString();
                errorText = stderr.toString();
            }

            if (err) {
                // Log the specific error from 1C
                if (errorText && errorText.trim().length > 0) {
                    console.error(`[RAC ERROR] Cmd: ${args[0]} ${args[1]}... -> ${errorText.trim()}`);
                }
                
                // Connection lost or Timeout
                if (err.killed || (errorText && (errorText.includes('Connect') || errorText.includes('refused')))) {
                    clusterId = null; // Force cluster ID refresh
                }
                return resolve(null);
            }
            resolve(output);
        });
    });
}

function parseOutput(output) {
    if (!output || typeof output !== 'string') return [];
    return output.replace(/\r\n/g, '\n').split(/\n\s*\n/).map(block => {
        const item = {};
        block.split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx !== -1) {
                // Key cleaning: remove BOM, spaces, convert to snake_case
                let key = line.substring(0, idx).trim()
                    .replace(/^\uFEFF/, '')
                    .toLowerCase()
                    .replace(/-/g, '_')
                    .replace(/\s+/g, '_');
                
                let val = line.substring(idx + 1).trim();
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                
                if (key) item[key] = val;
            }
        });
        return Object.keys(item).length > 0 ? item : null;
    }).filter(Boolean);
}

// --- CORE LOGIC ---

async function getClusterId() {
    if (clusterId) return clusterId;
    const out = await runRac(['cluster', 'list']);
    const list = parseOutput(out);
    if (list.length > 0 && list[0].cluster) {
        clusterId = list[0].cluster;
        dashboardStats.clusterStatus = 'online';
        return clusterId;
    }
    dashboardStats.clusterStatus = 'offline';
    return null;
}

/**
 * Get server metrics (CPU, RAM) using PowerShell
 */
function getServerMetrics() {
    return new Promise((resolve) => {
        // Получаем память
        const memCmd = `powershell -Command "$ProgressPreference = 'SilentlyContinue'; $os = Get-CimInstance Win32_OperatingSystem; Write-Output $os.TotalVisibleMemorySize; Write-Output $os.FreePhysicalMemory"`;
        
        exec(memCmd, { 
            encoding: 'binary', // Capture raw bytes for iconv
            timeout: POWERSHELL_TIMEOUT,
            windowsHide: true,
            maxBuffer: 1024 * 1024 
        }, (memError, memStdout, memStderr) => {
            let memory = { used: 0, total: 0, percent: 0 };
            
            if (!memError && memStdout) {
                try {
                    // Декодируем CP866 в UTF-8 для русского текста
                    let output = memStdout;
                    if (iconv) {
                        try {
                            output = iconv.decode(Buffer.from(memStdout, 'binary'), 'cp866');
                        } catch (e) {
                            output = memStdout.toString();
                        }
                    } else {
                        output = memStdout.toString();
                    }
                    
                    // Фильтруем CLIXML строки
                    const cleanOutput = output
                        .split('\n')
                        .filter(line => {
                            const trimmed = line.trim();
                            return trimmed !== '' && 
                                   !trimmed.startsWith('#< CLIXML') && 
                                   !trimmed.startsWith('<Objs') &&
                                   !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
                        })
                        .join('\n');
                    
                    const memLines = cleanOutput.trim().split('\n').filter(l => l.trim());
                    const totalMemKB = parseInt(memLines[0]?.trim() || '0');
                    const freeMemKB = parseInt(memLines[1]?.trim() || '0');
                    const usedMemKB = totalMemKB - freeMemKB;
                    const totalMemGB = totalMemKB / (1024 * 1024);
                    const usedMemGB = usedMemKB / (1024 * 1024);
                    const memPercent = totalMemKB > 0 ? Math.round((usedMemKB / totalMemKB) * 100) : 0;
                    
                    memory = {
                        used: Math.round(usedMemGB * 100) / 100,
                        total: Math.round(totalMemGB * 100) / 100,
                        percent: memPercent
                    };
                } catch (e) {
                    console.error('Error parsing memory metrics:', e);
                }
            }
            
            // Получаем CPU через WMI (более надежный способ)
            const cpuCmd = `powershell -Command "$ProgressPreference = 'SilentlyContinue'; $cpu = Get-WmiObject Win32_Processor | Measure-Object -property LoadPercentage -Average; Write-Output $cpu.Average"`;
            
            exec(cpuCmd, { 
                encoding: 'binary', // Capture raw bytes for iconv
                timeout: POWERSHELL_TIMEOUT,
                windowsHide: true,
                maxBuffer: 1024 * 1024 
            }, (cpuError, cpuStdout, cpuStderr) => {
                let cpu = 0;
                
                if (!cpuError && cpuStdout) {
                    try {
                        // Декодируем CP866 в UTF-8
                        let output = cpuStdout;
                        if (iconv) {
                            try {
                                output = iconv.decode(Buffer.from(cpuStdout, 'binary'), 'cp866');
                            } catch (e) {
                                output = cpuStdout.toString();
                            }
                        } else {
                            output = cpuStdout.toString();
                        }
                        
                        // Фильтруем CLIXML
                        const cleanOutput = output
                            .split('\n')
                            .filter(line => {
                                const trimmed = line.trim();
                                return trimmed !== '' && 
                                       !trimmed.startsWith('#< CLIXML') && 
                                       !trimmed.startsWith('<Objs') &&
                                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
                            })
                            .join('\n');
                        
                        const cpuValue = parseFloat(cleanOutput.trim());
                        if (!isNaN(cpuValue)) {
                            cpu = Math.round(cpuValue);
                        }
                    } catch (e) {
                        console.error('Error parsing CPU metrics:', e);
                    }
                }
                
                // Если CPU не удалось получить через WMI, пробуем альтернативный способ
                if (cpu === 0 || isNaN(cpu)) {
                    const altCpuCmd = `powershell -Command "$ProgressPreference = 'SilentlyContinue'; $proc = Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue; if ($proc) { $proc.CounterSamples.CookedValue }"`;
                    
                    exec(altCpuCmd, { 
                        encoding: 'binary', // Capture raw bytes for iconv
                        timeout: POWERSHELL_TIMEOUT,
                        windowsHide: true,
                        maxBuffer: 1024 * 1024 
                    }, (altCpuError, altCpuStdout, altCpuStderr) => {
                        if (!altCpuError && altCpuStdout) {
                            try {
                                // Декодируем CP866 в UTF-8
                                let output = altCpuStdout;
                                if (iconv) {
                                    try {
                                        output = iconv.decode(Buffer.from(altCpuStdout, 'binary'), 'cp866');
                                    } catch (e) {
                                        output = altCpuStdout.toString();
                                    }
                                } else {
                                    output = altCpuStdout.toString();
                                }
                                
                                // Фильтруем CLIXML
                                const cleanOutput = output
                                    .split('\n')
                                    .filter(line => {
                                        const trimmed = line.trim();
                                        return trimmed !== '' && 
                                               !trimmed.startsWith('#< CLIXML') && 
                                               !trimmed.startsWith('<Objs') &&
                                               !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
                                    })
                                    .join('\n');
                                
                                const altCpuValue = parseFloat(cleanOutput.trim());
                                if (!isNaN(altCpuValue)) {
                                    cpu = Math.round(altCpuValue);
                                }
                            } catch (e) {
                                // Игнорируем ошибки парсинга
                            }
                        }
                        
                        resolve({ cpu, memory });
                    });
                } else {
                    resolve({ cpu, memory });
                }
            });
        });
    });
}

/**
 * Get server system information (hostname, OS version)
 */
function getServerInfo() {
    return new Promise((resolve) => {
        const cmd = `powershell -Command "$ProgressPreference = 'SilentlyContinue'; $os = Get-CimInstance Win32_OperatingSystem; $hostname = $env:COMPUTERNAME; Write-Output $hostname; Write-Output $os.Caption"`;
        
        exec(cmd, { 
            encoding: 'binary', // Capture raw bytes for iconv
            timeout: POWERSHELL_TIMEOUT,
            windowsHide: true,
            maxBuffer: 1024 * 1024 
        }, (error, stdout, stderr) => {
            let hostname = 'Unknown';
            let osVersion = 'Unknown';
            
            if (!error && stdout) {
                try {
                    // Decode CP866 to UTF-8 for Russian text
                    let output = stdout;
                    if (iconv) {
                        try {
                            output = iconv.decode(Buffer.from(stdout, 'binary'), 'cp866');
                        } catch (e) {
                            output = stdout.toString();
                        }
                    } else {
                        output = stdout.toString();
                    }
                    
                    // Фильтруем CLIXML строки
                    const cleanOutput = output
                        .split('\n')
                        .filter(line => {
                            const trimmed = line.trim();
                            return trimmed !== '' && 
                                   !trimmed.startsWith('#< CLIXML') && 
                                   !trimmed.startsWith('<Objs') &&
                                   !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
                        })
                        .join('\n');
                    
                    const lines = cleanOutput.trim().split('\n').filter(l => l.trim());
                    hostname = lines[0]?.trim() || process.env.COMPUTERNAME || os.hostname();
                    osVersion = lines[1]?.trim() || 'Unknown';
                } catch (e) {
                    console.error('Error parsing server info:', e);
                    // Fallback to Node.js os module
                    hostname = os.hostname();
                    osVersion = os.type() + ' ' + os.release();
                }
            } else {
                // Fallback to Node.js os module
                hostname = os.hostname();
                osVersion = os.type() + ' ' + os.release();
            }
            
            resolve({ hostname, osVersion });
        });
    });
}

/**
 * Get database sizes from MSSQL
 * Returns object { dbName: sizeInMB }
 */
async function getDatabaseSizes() {
    if (!mssql || !settings.mssqlEnabled) {
        return {};
    }

    if (!settings.mssqlServer || !settings.mssqlUser || !settings.mssqlPassword) {
        return {};
    }

    let pool = null;
    try {
        const config = {
            server: settings.mssqlServer,
            port: settings.mssqlPort || 1433,
            database: settings.mssqlDatabase || 'master',
            user: settings.mssqlUser,
            password: settings.mssqlPassword,
            options: {
                encrypt: false, // Use false for local development
                trustServerCertificate: true,
                enableArithAbort: true,
                requestTimeout: 30000 // 30 seconds
            }
        };

        pool = await mssql.connect(config);
        const request = pool.request();

        // Query to get database sizes (data files only)
        // Use DB_NAME(database_id) to get actual database name, not file name
        const query = `
            SELECT 
                DB_NAME(database_id) AS DatabaseName,
                CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(10, 2)) AS SizeMB
            FROM sys.master_files
            WHERE type = 0
            GROUP BY database_id
        `;

        const result = await request.query(query);
        const sizes = {};

        if (result.recordset && result.recordset.length > 0) {
            console.log('[MSSQL] Databases found in SQL Server:');
            result.recordset.forEach(row => {
                if (row.DatabaseName && row.SizeMB !== null) {
                    sizes[row.DatabaseName] = parseFloat(row.SizeMB);
                    console.log(`  - ${row.DatabaseName}: ${row.SizeMB.toFixed(2)} MB`);
                }
            });
        } else {
            console.log('[MSSQL] No databases found in result');
        }

        return sizes;
    } catch (error) {
        console.error('[MSSQL ERROR] Failed to get database sizes:', error.message);
        logEvent('warning', `Ошибка подключения к MSSQL: ${error.message}`);
        return {};
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * Get cached database sizes or fetch new ones if cache is expired
 */
async function getCachedDatabaseSizes() {
    const now = Date.now();
    
    // Check if cache is valid
    if (databaseSizesCache.timestamp && 
        (now - databaseSizesCache.timestamp) < databaseSizesCache.ttl &&
        Object.keys(databaseSizesCache.data).length > 0) {
        return databaseSizesCache.data;
    }

    // Fetch new data
    const sizes = await getDatabaseSizes();
    
    // Update cache
    databaseSizesCache.data = sizes;
    databaseSizesCache.timestamp = now;
    
    return sizes;
}

async function terminateSession(sessionId, cId, clientName, dbName, userName, reason) {
    if (!sessionId || !cId) return false;

    console.log(`[KILL] Terminating session ${sessionId} for ${clientName}`);
    
    // Auth args
    const authArgs = settings.clusterUser ? [`--cluster-user=${settings.clusterUser}`, `--cluster-pwd=${settings.clusterPass}`] : [];

    // Optional Error Message argument
    let msgArgs = [];
    if (reason) {
        // Send reason directly (assuming UTF-8 or compatible locale)
        const safeMessage = reason.replace(/"/g, "'");
        msgArgs.push(`--error-message="${safeMessage}"`);
    }

    const res = await runRac([
        'session', 'terminate', 
        `--cluster=${cId}`, 
        `--session=${sessionId}`,
        ...msgArgs,
        ...authArgs
    ]);

    if (res === null) {
        console.error(`[KILL FAILED] Could not terminate session ${sessionId}. Check logs above.`);
        return false;
    }
    
    // Log successful termination with rich details
    const userStr = userName && userName !== '' ? userName : 'Не определен';
    const dbStr = dbName && dbName !== '' ? dbName : 'Не определена';
    
    logEvent('info', `Сеанс завершен. Клиент: ${clientName}, База: ${dbStr}, Пользователь: ${userStr}`);
    
    return true;
}

async function monitorRoutine() {
    if (isMonitoring) return;
    isMonitoring = true;

    try {
        const cId = await getClusterId();
        if (!cId) throw new Error("No Cluster ID");

        // 1. Sync Infobases (Update Map)
        const dbOut = await runRac(['infobase', 'summary', 'list', `--cluster=${cId}`, ...(settings.clusterUser ? [`--cluster-user=${settings.clusterUser}`, `--cluster-pwd=${settings.clusterPass}`] : [])]);
        
        if (dbOut) {
            const newList = parseOutput(dbOut);
            
            dbMap = {};
            newList.forEach(db => {
                // FIX: 1C 'summary list' uses 'infobase' for the UUID, not 'uuid'. 'list' uses 'uuid'.
                // We check both to be safe.
                const uid = db.infobase || db.uuid || db.infobase_id; 
                if (uid && db.name) {
                    dbMap[uid] = db.name;
                }
            });
        }

        // 2. Get Sessions
        const sessOut = await runRac(['session', 'list', `--cluster=${cId}`, ...(settings.clusterUser ? [`--cluster-user=${settings.clusterUser}`, `--cluster-pwd=${settings.clusterPass}`] : [])]);
        if (sessOut === null) throw new Error("Failed to get sessions");

        const rawSessions = parseOutput(sessOut);
        const sessions = rawSessions.filter(s => 
            // Filter only user sessions (exclude Designer if you want, currently checking AppID)
            ['1CV8', '1CV8C', 'WebClient', 'App'].includes(s.app_id) 
        );

        // Update dashboard statistics: connection types and database stats
        dashboardStats.connectionTypes = { '1CV8': 0, '1CV8C': 0, 'WebClient': 0, 'App': 0 };
        dashboardStats.databaseStats = {};
        
        sessions.forEach(s => {
            // Count connection types
            const appId = s.app_id || 'Unknown';
            if (dashboardStats.connectionTypes[appId] !== undefined) {
                dashboardStats.connectionTypes[appId]++;
            }
            
            // Count database sessions
            const sUuid = s.infobase || s.infobase_id;
            const dbName = dbMap[sUuid] || 'Неизвестная БД';
            if (!dashboardStats.databaseStats[dbName]) {
                dashboardStats.databaseStats[dbName] = { sessions: 0 };
            }
            dashboardStats.databaseStats[dbName].sessions++;
        });
        
        dashboardStats.lastUpdate = new Date().toISOString();

        // 3. Map Sessions to Clients
        const usage = clients.reduce((acc, client) => {
            acc[client.id] = { client, count: 0, sessions: [], dbCounts: {} };
            // Safety check for databases array
            if (Array.isArray(client.databases)) {
                client.databases.forEach(db => {
                    if (db && db.name) {
                        acc[client.id].dbCounts[db.name] = 0;
                    }
                });
            }
            return acc;
        }, {});

        sessions.forEach(s => {
            // FIX: Ensure we have the Cluster Session ID (usually 'session' or 'session_id')
            const sId = s.session || s.session_id; 
            if (!sId) return;

            const sUuid = s.infobase || s.infobase_id;
            const sName = dbMap[sUuid] || '';
            
            // Find owner client
            for (const cid in usage) {
                const map = usage[cid];
                // Match by DB Name (from Map) OR by direct UUID match in settings
                const match = Array.isArray(map.client.databases) && map.client.databases.find(d => 
                    (sName && d.name && d.name.toLowerCase() === sName.toLowerCase()) || 
                    (sUuid && d.name === sUuid)
                );
                
                if (match) {
                    map.count++;
                    map.dbCounts[match.name] = (map.dbCounts[match.name] || 0) + 1;
                    map.sessions.push({
                        id: sId,
                        start: s.started_at ? new Date(s.started_at).getTime() : Date.now(),
                        // Store info for logging
                        userName: s.user_name,
                        dbName: match.name
                    });
                    return; // Assigned
                }
            }
        });

        // 4. Enforce Limits & Blocks
        for (const cid in usage) {
            const { client, count, sessions, dbCounts } = usage[cid];
            
            // Update stats in memory object
            client.activeSessions = count;
            if (Array.isArray(client.databases)) {
                client.databases.forEach(db => db.activeSessions = dbCounts[db.name] || 0);
            }

            // Determine if action is needed (Kill Mode enabled)
            if (settings.killMode && count > 0) {
                let sessionsToKill = [];
                let reason = "";

                // Scenario A: Client is Blocked (Kill ALL sessions)
                if (client.status === 'blocked') {
                    sessionsToKill = sessions;
                    reason = "Доступ заблокирован администратором.";
                    logEvent('warning', `Блокировка клиента: ${client.name}. Завершение всех (${count}) сеансов.`);
                }
                // Scenario B: Limit Exceeded (Kill newest excess sessions)
                else if (client.maxSessions > 0 && count > client.maxSessions) {
                    const excess = count - client.maxSessions;
                    reason = "Лимит сеансов превышен. Обратитесь к администратору.";
                    
                    logEvent('warning', `Лимит превышен: ${client.name} (${count}/${client.maxSessions}). Завершение ${excess} сеансов.`);

                    // Sort LIFO (Last In First Out) - kill newest sessions first
                    sessions.sort((a, b) => b.start - a.start);
                    sessionsToKill = sessions.slice(0, excess);
                }

                // Execute Kills
                for (const s of sessionsToKill) {
                    await terminateSession(s.id, cId, client.name, s.dbName, s.userName, reason);
                }
            }
        }
        
        saveData();

    } catch (e) {
        if (e.message !== "No Cluster ID") {
            console.error("Monitor Error:", e.message);
        }
    } finally {
        isMonitoring = false;
        // Schedule next run recursive
        setTimeout(monitorRoutine, settings.checkInterval * 1000);
    }
}

// Start Loop
setTimeout(monitorRoutine, 3000);

// --- ROUTES ---

app.get('/api/clients', (req, res) => {
    try {
        res.json(clients);
    } catch (error) {
        console.error('Error getting clients:', error);
        res.status(500).json({ error: 'Failed to get clients', message: error.message });
    }
});
app.post('/api/clients', (req, res) => {
    try {
        // Basic validation
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Invalid request body' });
        }
        
        if (!req.body.name || typeof req.body.name !== 'string' || req.body.name.trim() === '') {
            return res.status(400).json({ error: 'Client name is required' });
        }
        
        if (typeof req.body.maxSessions !== 'number' || req.body.maxSessions < 0) {
            return res.status(400).json({ error: 'maxSessions must be a non-negative number' });
        }
        
        // Ensure databases is an array
        if (!Array.isArray(req.body.databases)) {
            req.body.databases = [];
        }
        
        const newClient = {
            ...req.body,
            id: Date.now().toString(),
            activeSessions: 0,
            status: req.body.status || 'active',
            databases: req.body.databases.map(db => ({
                name: db.name || '',
                activeSessions: 0
            }))
        };
        
        clients.push(newClient);
        saveData();
        logEvent('info', `Клиент добавлен: ${newClient.name}`);
        res.json(newClient);
    } catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({ error: 'Failed to add client', message: error.message });
    }
});
app.put('/api/clients/:id', (req, res) => {
    try {
        const idx = clients.findIndex(c => c.id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        // Basic validation
        if (req.body.name !== undefined && (typeof req.body.name !== 'string' || req.body.name.trim() === '')) {
            return res.status(400).json({ error: 'Client name must be a non-empty string' });
        }
        
        if (req.body.maxSessions !== undefined && (typeof req.body.maxSessions !== 'number' || req.body.maxSessions < 0)) {
            return res.status(400).json({ error: 'maxSessions must be a non-negative number' });
        }
        
        // Preserve activeSessions and ensure databases structure
        const updatedClient = {
            ...clients[idx],
            ...req.body,
            id: req.params.id, // Prevent ID change
            activeSessions: clients[idx].activeSessions, // Preserve current sessions
            databases: Array.isArray(req.body.databases) 
                ? req.body.databases.map(db => ({
                    name: db.name || '',
                    activeSessions: db.activeSessions || 0
                }))
                : clients[idx].databases
        };
        
        clients[idx] = updatedClient;
        saveData();
        logEvent('info', `Клиент обновлен: ${updatedClient.name}`);
        res.json(updatedClient);
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Failed to update client', message: error.message });
    }
});
app.delete('/api/clients/:id', (req, res) => {
    try {
        const clientId = req.params.id;
        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }
        
        const clientExists = clients.some(c => c.id === clientId);
        if (!clientExists) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        clients = clients.filter(c => c.id !== clientId);
        saveData();
        logEvent('info', `Клиент удален: ID ${clientId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client', message: error.message });
    }
});

app.get('/api/events', (req, res) => {
    try {
        res.json(events);
    } catch (error) {
        console.error('Error getting events:', error);
        res.status(500).json({ error: 'Failed to get events', message: error.message });
    }
});
app.delete('/api/events', (req, res) => {
    try {
        events = [];
        saveData();
        logEvent('info', 'Журнал событий очищен администратором');
        res.json({ success: true, message: 'Events cleared' });
    } catch (error) {
        console.error('Error clearing events:', error);
        res.status(500).json({ success: false, error: 'Failed to clear events' });
    }
});
app.get('/api/settings', (req, res) => {
    try {
        // Don't send decrypted passwords to client - replace with placeholder
        const safeSettings = prepareSettingsForResponse(settings);
        res.json(safeSettings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});
app.post('/api/settings', (req, res) => {
    try {
        const oldMssqlSettings = {
            server: settings.mssqlServer,
            port: settings.mssqlPort,
            database: settings.mssqlDatabase,
            user: settings.mssqlUser,
            password: settings.mssqlPassword,
            enabled: settings.mssqlEnabled
        };
        
        // Handle password fields - if client sends '***ENCRYPTED***', keep existing encrypted password
        const newSettings = { ...req.body };
        
        // Load current encrypted passwords from file
        const currentEncryptedSettings = loadJSON(SETTINGS_FILE, {});
        
        // If password field is '***ENCRYPTED***' or empty, keep existing encrypted password
        if (newSettings.clusterPass === '***ENCRYPTED***' || newSettings.clusterPass === '') {
            if (currentEncryptedSettings.clusterPass) {
                // Keep existing encrypted password, but decrypt it for in-memory use
                delete newSettings.clusterPass; // Don't overwrite
                // Current decrypted password in memory will remain
            } else {
                delete newSettings.clusterPass; // No password to keep
            }
        }
        
        if (newSettings.mssqlPassword === '***ENCRYPTED***' || newSettings.mssqlPassword === '') {
            if (currentEncryptedSettings.mssqlPassword) {
                // Keep existing encrypted password
                delete newSettings.mssqlPassword; // Don't overwrite
            } else {
                delete newSettings.mssqlPassword; // No password to keep
            }
        }
        
        // Merge new settings with existing (preserving passwords that weren't changed)
        settings = { ...settings, ...newSettings };
        saveData();
        
        // Clear MSSQL cache if settings changed
        const newMssqlSettings = {
            server: settings.mssqlServer,
            port: settings.mssqlPort,
            database: settings.mssqlDatabase,
            user: settings.mssqlUser,
            password: settings.mssqlPassword,
            enabled: settings.mssqlEnabled
        };
        
        if (JSON.stringify(oldMssqlSettings) !== JSON.stringify(newMssqlSettings)) {
            databaseSizesCache = {
                data: {},
                timestamp: null,
                ttl: 300000
            };
        }
        
        // Return safe settings (with encrypted placeholder)
        const safeSettings = prepareSettingsForResponse(settings);
        res.json(safeSettings);
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

app.post('/api/test-connection', async (req, res) => {
    // Save original settings before test
    const oldRac = settings.racPath; 
    const oldRas = settings.rasHost;
    
    try {
        const tempSettings = { ...settings, ...req.body };
        
        // Temporarily update settings for test
        settings.racPath = tempSettings.racPath;
        settings.rasHost = tempSettings.rasHost;
        
        clusterId = null; // Reset cached ID for test
        const out = await runRac(['cluster', 'list']);
        
        // Revert settings
        settings.racPath = oldRac; 
        settings.rasHost = oldRas;

        if (out === null) {
            return res.json({ 
                success: false, 
                error: "Соединение не установлено. Проверьте:\n- Путь к rac.exe\n- Адрес RAS сервера\n- Запущен ли сервер 1С" 
            });
        }
        
        res.json({ success: true, output: out });
    } catch (error) {
        // Ensure settings are reverted even on error
        settings.racPath = oldRac;
        settings.rasHost = oldRas;
        
        console.error('Error in test-connection:', error);
        res.status(500).json({ 
            success: false, 
            error: `Ошибка при проверке соединения: ${error.message || 'Неизвестная ошибка'}` 
        });
    }
});

app.post('/api/test-mssql-connection', async (req, res) => {
    if (!mssql) {
        return res.json({
            success: false,
            error: 'Пакет mssql не установлен. Установите его через npm install mssql'
        });
    }

    // Save original settings before test
    const oldSettings = { ...settings };
    
    try {
        const tempSettings = { ...settings, ...req.body };
        
        if (!tempSettings.mssqlServer || !tempSettings.mssqlUser || !tempSettings.mssqlPassword) {
            return res.json({
                success: false,
                error: 'Необходимо указать сервер, пользователя и пароль для подключения к MSSQL'
            });
        }

        const config = {
            server: tempSettings.mssqlServer,
            port: parseInt(tempSettings.mssqlPort) || 1433,
            database: tempSettings.mssqlDatabase || 'master',
            user: tempSettings.mssqlUser,
            password: tempSettings.mssqlPassword,
            options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true,
                requestTimeout: 10000 // 10 seconds for test
            }
        };

        let pool = null;
        try {
            pool = await mssql.connect(config);
            const request = pool.request();
            
            // Simple test query
            const result = await request.query('SELECT @@VERSION AS Version');
            
            // Close connection
            await pool.close();
            
            res.json({
                success: true,
                message: 'Подключение к MSSQL установлено успешно',
                version: result.recordset[0]?.Version || 'Unknown'
            });
        } catch (error) {
            if (pool) {
                try {
                    await pool.close();
                } catch (e) {
                    // Ignore close errors
                }
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in test-mssql-connection:', error);
        res.json({
            success: false,
            error: `Ошибка подключения к MSSQL: ${error.message || 'Неизвестная ошибка'}`
        });
    }
});

app.get('/api/infobases', (req, res) => {
    try {
        const list = Object.entries(dbMap).map(([uuid, name]) => ({ name, uuid }));
        res.json(list);
    } catch (error) {
        console.error('Error getting infobases:', error);
        res.status(500).json({ error: 'Failed to get infobases', message: error.message });
    }
});

// Dashboard API endpoints
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // Get server metrics
        const serverMetrics = await getServerMetrics();
        
        // Get database sizes from MSSQL if enabled
        let databaseSizes = {};
        if (settings.mssqlEnabled) {
            try {
                databaseSizes = await getCachedDatabaseSizes();
            } catch (error) {
                console.error('Error fetching database sizes:', error);
                // Use cached data if available even on error
                databaseSizes = databaseSizesCache.data || {};
            }
        }
        
        // Get all databases from 1C (from dbMap)
        const allDatabasesFrom1C = Object.values(dbMap);
        const databasesWithSessions = Object.keys(dashboardStats.databaseStats);
        const dbNamesFromMSSQL = Object.keys(databaseSizes);
        
        // Combine all databases: from 1C and from MSSQL
        const allDatabaseNames = new Set([...allDatabasesFrom1C, ...dbNamesFromMSSQL]);
        
        if (settings.mssqlEnabled) {
            console.log('[DB MATCHING] All databases from 1C:', allDatabasesFrom1C.join(', '));
            console.log('[DB MATCHING] All databases from MSSQL:', dbNamesFromMSSQL.join(', '));
        }
        
        // Build complete database stats with all databases
        const databaseStatsWithSizes = {};
        allDatabaseNames.forEach(dbName => {
            // Get session count (0 if no active sessions)
            const sessions = dashboardStats.databaseStats[dbName]?.sessions || 0;
            
            // Try to find size from MSSQL
            let sizeMB = databaseSizes[dbName];
            
            // If not found, try case-insensitive match
            if (sizeMB === undefined) {
                const matchKey = dbNamesFromMSSQL.find(key => 
                    key.toLowerCase() === dbName.toLowerCase()
                );
                if (matchKey) {
                    sizeMB = databaseSizes[matchKey];
                    console.log(`[DB MATCHING] Case-insensitive match: "${dbName}" = "${matchKey}"`);
                }
            }
            
            databaseStatsWithSizes[dbName] = {
                sessions: sessions,
                sizeMB: sizeMB || undefined
            };
        });
        
        res.json({
            databaseStats: databaseStatsWithSizes,
            connectionTypes: dashboardStats.connectionTypes,
            clusterStatus: dashboardStats.clusterStatus,
            serverMetrics: serverMetrics,
            lastUpdate: dashboardStats.lastUpdate
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

app.get('/api/dashboard/top-clients', (req, res) => {
    try {
        const topClients = clients
            .filter(c => c.maxSessions > 0) // Only clients with limits
            .map(c => ({
                id: c.id,
                name: c.name,
                activeSessions: c.activeSessions,
                maxSessions: c.maxSessions,
                utilization: c.maxSessions > 0 ? Math.round((c.activeSessions / c.maxSessions) * 100) : 0,
                status: c.status
            }))
            .sort((a, b) => b.activeSessions - a.activeSessions)
            .slice(0, 5);
        
        res.json(topClients);
    } catch (error) {
        console.error('Error getting top clients:', error);
        res.status(500).json({ error: 'Failed to get top clients' });
    }
});

app.get('/api/dashboard/warnings', (req, res) => {
    try {
        const warnings = clients
            .filter(c => {
                if (c.status === 'blocked') return true;
                if (c.maxSessions > 0 && c.activeSessions > 0) {
                    const utilization = (c.activeSessions / c.maxSessions) * 100;
                    return utilization >= 80; // 80% or more
                }
                return false;
            })
            .map(c => ({
                id: c.id,
                name: c.name,
                activeSessions: c.activeSessions,
                maxSessions: c.maxSessions,
                utilization: c.maxSessions > 0 ? Math.round((c.activeSessions / c.maxSessions) * 100) : 0,
                status: c.status,
                reason: c.status === 'blocked' ? 'Заблокирован' : 
                       c.maxSessions > 0 && c.activeSessions >= c.maxSessions ? 'Лимит превышен' : 
                       'Высокая загрузка (>80%)'
            }));
        
        res.json(warnings);
    } catch (error) {
        console.error('Error getting warnings:', error);
        res.status(500).json({ error: 'Failed to get warnings' });
    }
});

app.get('/api/server/info', async (req, res) => {
    try {
        const serverInfo = await getServerInfo();
        res.json(serverInfo);
    } catch (error) {
        console.error('Error getting server info:', error);
        res.status(500).json({ error: 'Failed to get server info' });
    }
});

// AI Analysis endpoint (server-side only to protect API key)
app.post('/api/ai/analyze', async (req, res) => {
    try {
        // Import geminiService only on server side
        let geminiService;
        try {
            const geminiModule = await import('./services/geminiService.js');
            geminiService = geminiModule;
        } catch (e) {
            console.error("Notice: Gemini service not available.");
            return res.status(503).json({ 
                error: 'AI analysis service not available',
                message: 'Please check API key configuration'
            });
        }

        const { clients: clientData, events: eventData } = req.body;
        
        if (!clientData || !eventData) {
            return res.status(400).json({ error: 'clients and events data required' });
        }

        const insight = await geminiService.analyzeSystemHealth(clientData, eventData);
        res.json({ insight });
    } catch (error) {
        console.error('Error in AI analysis:', error);
        res.status(500).json({ 
            error: 'Failed to perform AI analysis',
            message: error.message 
        });
    }
});

// Serve static files from dist (Vite build output) or public
// This is placed after API routes to ensure API requests are not intercepted
const staticDir = fs.existsSync(path.join(__dirname, 'dist')) 
    ? path.join(__dirname, 'dist')
    : path.join(__dirname, 'public');
app.use(express.static(staticDir));

// Serve UI (catch-all route must be last)
app.get(/.*/, (req, res) => {
    const indexPath = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
        ? path.join(__dirname, 'dist', 'index.html')
        : path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath);
});

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    logEvent('critical', `Критическая ошибка: ${error.message}`);
    // Don't exit in production, but log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    logEvent('critical', `Необработанное отклонение промиса: ${reason}`);
});

// Express error handler middleware
app.use((err, req, res, next) => {
    console.error('[API ERROR]', err);
    logEvent('error', `Ошибка API: ${err.message}`);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
    console.log(`1C Session Manager running on port ${PORT}`);
    logEvent('info', 'Service started');
});
