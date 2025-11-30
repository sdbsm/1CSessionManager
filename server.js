import express from 'express';
import { execFile, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
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
    killMode: true
};

// --- STATE ---
function loadJSON(filepath, defaultVal) {
    try {
        if (fs.existsSync(filepath)) return JSON.parse(fs.readFileSync(filepath));
    } catch (e) { console.error(`Error loading ${filepath}`, e); }
    return defaultVal;
}

let clients = loadJSON(CLIENTS_FILE, []);
let settings = { ...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_FILE, {}) };
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

function saveData() {
    try {
        fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(events.slice(0, 100), null, 2));
    } catch (e) { console.error("Save Error:", e); }
}

function logEvent(level, message) {
    const event = { id: Date.now().toString(), timestamp: new Date().toLocaleString('ru-RU'), level, message };
    events.unshift(event);
    if (events.length > 100) events.pop();
    saveData();
    console.log(`[${level.toUpperCase()}] ${message}`);
}

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
            timeout: 30000 // 30s timeout safety
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
        const memCmd = `powershell -Command "$os = Get-CimInstance Win32_OperatingSystem; Write-Output $os.TotalVisibleMemorySize; Write-Output $os.FreePhysicalMemory"`;
        
        exec(memCmd, { 
            timeout: 5000,
            windowsHide: true,
            maxBuffer: 1024 * 1024 
        }, (memError, memStdout, memStderr) => {
            let memory = { used: 0, total: 0, percent: 0 };
            
            if (!memError && memStdout) {
                try {
                    const memLines = memStdout.trim().split('\n').filter(l => l.trim());
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
            const cpuCmd = `powershell -Command "$cpu = Get-WmiObject Win32_Processor | Measure-Object -property LoadPercentage -Average; Write-Output $cpu.Average"`;
            
            exec(cpuCmd, { 
                timeout: 5000,
                windowsHide: true,
                maxBuffer: 1024 * 1024 
            }, (cpuError, cpuStdout, cpuStderr) => {
                let cpu = 0;
                
                if (!cpuError && cpuStdout) {
                    try {
                        const cpuValue = parseFloat(cpuStdout.trim());
                        if (!isNaN(cpuValue)) {
                            cpu = Math.round(cpuValue);
                        }
                    } catch (e) {
                        console.error('Error parsing CPU metrics:', e);
                    }
                }
                
                // Если CPU не удалось получить через WMI, пробуем альтернативный способ
                if (cpu === 0 || isNaN(cpu)) {
                    const altCpuCmd = `powershell -Command "$proc = Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue; if ($proc) { $proc.CounterSamples.CookedValue }"`;
                    
                    exec(altCpuCmd, { 
                        timeout: 3000,
                        windowsHide: true,
                        maxBuffer: 1024 * 1024 
                    }, (altCpuError, altCpuStdout, altCpuStderr) => {
                        if (!altCpuError && altCpuStdout) {
                            try {
                                const altCpuValue = parseFloat(altCpuStdout.trim());
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

app.get('/api/clients', (req, res) => res.json(clients));
app.post('/api/clients', (req, res) => {
    clients.push({ ...req.body, id: Date.now().toString(), activeSessions: 0 });
    saveData();
    res.json(clients[clients.length - 1]);
});
app.put('/api/clients/:id', (req, res) => {
    const idx = clients.findIndex(c => c.id === req.params.id);
    if (idx !== -1) {
        clients[idx] = { ...clients[idx], ...req.body };
        saveData();
        res.json(clients[idx]);
    } else res.sendStatus(404);
});
app.delete('/api/clients/:id', (req, res) => {
    clients = clients.filter(c => c.id !== req.params.id);
    saveData();
    res.json({ success: true });
});

app.get('/api/events', (req, res) => res.json(events));
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
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});
app.post('/api/settings', (req, res) => {
    try {
        settings = { ...settings, ...req.body };
        saveData();
        res.json(settings);
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

app.get('/api/infobases', (req, res) => {
    const list = Object.entries(dbMap).map(([uuid, name]) => ({ name, uuid }));
    res.json(list);
});

// Dashboard API endpoints
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // Get server metrics
        const serverMetrics = await getServerMetrics();
        
        res.json({
            databaseStats: dashboardStats.databaseStats,
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

app.listen(PORT, () => {
    console.log(`1C Session Manager running on port ${PORT}`);
    logEvent('info', 'Service started');
});
