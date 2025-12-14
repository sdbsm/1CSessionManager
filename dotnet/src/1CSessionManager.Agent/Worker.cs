using Microsoft.EntityFrameworkCore;
using SessionManager.Agent.Services;
using SessionManager.Agent.Services.Rac;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Data.Enums;
using SessionManager.Shared.Security;

namespace SessionManager.Agent;

public class Worker(
    ILogger<Worker> logger,
    IDbContextFactory<AppDbContext> dbFactory) : BackgroundService
{
    private readonly RacClient _rac = new(timeout: TimeSpan.FromSeconds(30));
    private readonly SecretProtector _protector = new();
    private DateTime _lastRacNotFoundLogUtc = DateTime.MinValue;
    private DateTime _lastRacErrorLogUtc = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var identity = new AgentIdentityProvider();
        var agentId = identity.GetOrCreateAgentId();

        logger.LogInformation("Agent starting. AgentId={AgentId}", agentId);

        // Ensure we can connect and register agent instance record
        try
        {
            await using var db = await dbFactory.CreateDbContextAsync(stoppingToken);
            await db.Database.OpenConnectionAsync(stoppingToken);
            await db.Database.CloseConnectionAsync();

            await UpsertAgentAsync(dbFactory, agentId, stoppingToken);
            await WriteEventAsync(dbFactory, agentId, EventLevel.Info, "Agent started", stoppingToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize DB connection.");
            // If DB is down, keep running: agent should continue trying.
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Heartbeat first (keeps LastSeen fresh even if RAC hangs later)
                await UpsertAgentAsync(dbFactory, agentId, stoppingToken);

                // Load agent settings and clients
                var agent = await GetAgentAsync(dbFactory, agentId, stoppingToken);
                if (!agent.Enabled)
                {
                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                    continue;
                }

                var clients = await LoadClientsAsync(dbFactory, agentId, stoppingToken);

                // Monitor iteration (RAC)
                try
                {
                    // 1) Get cluster id
                    var clusterId = await GetClusterIdAsync(agent, stoppingToken);
                    if (clusterId is null)
                    {
                        await UpdateClusterStatusAsync(dbFactory, agentId, ClusterStatus.Offline, stoppingToken);
                        await WriteMetricBucketSafeAsync(dbFactory, agentId, ClusterStatus.Offline, totalSessions: 0, clients, stoppingToken);
                        await Task.Delay(TimeSpan.FromSeconds(agent.PollIntervalSeconds), stoppingToken);
                        continue;
                    }

                    await UpdateClusterStatusAsync(dbFactory, agentId, ClusterStatus.Online, stoppingToken);

                    // 2) Sync infobases: uuid -> name
                    var dbMap = await GetInfobaseMapAsync(agent, clusterId, stoppingToken);

                    // 3) Sessions
                    var sessions = await GetSessionsAsync(agent, clusterId, dbMap, stoppingToken);

                    // 4) Enforce limits (kill-mode) and compute per-client counters
                    var counts = ComputeClientSessionCounts(clients, sessions);

                    if (agent.KillModeEnabled)
                    {
                        await EnforceLimitsAsync(agent, clusterId, clients, sessions, counts, stoppingToken);
                    }

                    // 5) Write aggregated metrics (minute bucket)
                    await WriteMetricBucketSafeAsync(dbFactory, agentId, ClusterStatus.Online, sessions.Count, clients, stoppingToken, counts);
                }
                catch (FileNotFoundException ex)
                {
                    // Typical case on first run: wrong/default rac.exe path.
                    var now = DateTime.UtcNow;
                    if (now - _lastRacNotFoundLogUtc > TimeSpan.FromMinutes(5))
                    {
                        _lastRacNotFoundLogUtc = now;
                        logger.LogWarning("RAC not found: {Path}. Configure RAC path in Control UI: http://localhost:3000/settings.html", ex.FileName);
                        try
                        {
                            await WriteEventAsync(dbFactory, agentId, EventLevel.Warning,
                                $"RAC не найден: {ex.FileName}. Укажите путь к rac.exe в веб-настройках (http://localhost:3000/settings.html).",
                                stoppingToken);
                        }
                        catch { /* ignore */ }
                    }

                    await UpdateClusterStatusAsync(dbFactory, agentId, ClusterStatus.Unknown, stoppingToken);
                    await WriteMetricBucketSafeAsync(dbFactory, agentId, ClusterStatus.Unknown, totalSessions: 0, clients, stoppingToken);
                }
                catch (TimeoutException ex)
                {
                    var now = DateTime.UtcNow;
                    if (now - _lastRacErrorLogUtc > TimeSpan.FromMinutes(5))
                    {
                        _lastRacErrorLogUtc = now;
                        logger.LogWarning(ex, "RAC timeout");
                    }
                    await UpdateClusterStatusAsync(dbFactory, agentId, ClusterStatus.Unknown, stoppingToken);
                    await WriteMetricBucketSafeAsync(dbFactory, agentId, ClusterStatus.Unknown, totalSessions: 0, clients, stoppingToken);
                }
                catch (Exception ex)
                {
                    var now = DateTime.UtcNow;
                    if (now - _lastRacErrorLogUtc > TimeSpan.FromMinutes(2))
                    {
                        _lastRacErrorLogUtc = now;
                        logger.LogError(ex, "RAC iteration failed");
                    }
                    await UpdateClusterStatusAsync(dbFactory, agentId, ClusterStatus.Unknown, stoppingToken);
                    await WriteMetricBucketSafeAsync(dbFactory, agentId, ClusterStatus.Unknown, totalSessions: 0, clients, stoppingToken);
                }

                await Task.Delay(TimeSpan.FromSeconds(agent.PollIntervalSeconds), stoppingToken);
            }
            catch (Exception ex)
            {
                // DB down / unexpected. Keep running but don't spam.
                var now = DateTime.UtcNow;
                if (now - _lastRacErrorLogUtc > TimeSpan.FromMinutes(2))
                {
                    _lastRacErrorLogUtc = now;
                    logger.LogError(ex, "Iteration failed.");
                }
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private static async Task UpsertAgentAsync(IDbContextFactory<AppDbContext> dbFactory, Guid agentId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);

        var now = DateTime.UtcNow;
        var hostname = Environment.MachineName;

        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, ct);
        if (agent is null)
        {
            agent = new AgentInstance
            {
                Id = agentId,
                Name = hostname,
                Hostname = hostname,
                CreatedAtUtc = now,
                LastSeenAtUtc = now,
                RacPath = @"C:\Program Files\1cv8\8.3.22.1709\bin\rac.exe",
                RasHost = "localhost:1545",
                ClusterUser = null,
                ClusterPassProtected = null,
                // Safer default for dev: do NOT kill sessions until explicitly enabled via UI.
                KillModeEnabled = false,
                PollIntervalSeconds = 30,
                Enabled = true,
                LastKnownClusterStatus = ClusterStatus.Unknown
            };

            db.Agents.Add(agent);
        }
        else
        {
            agent.LastSeenAtUtc = now;
            agent.Hostname = hostname;
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task WriteEventAsync(
        IDbContextFactory<AppDbContext> dbFactory,
        Guid agentId,
        EventLevel level,
        string message,
        CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        db.Events.Add(new SystemEvent
        {
            AgentId = agentId,
            TimestampUtc = DateTime.UtcNow,
            Level = level,
            Message = message
        });
        await db.SaveChangesAsync(ct);
    }

    private static DateTime RoundDownUtc(DateTime utc, TimeSpan interval)
    {
        var ticks = utc.Ticks - (utc.Ticks % interval.Ticks);
        return new DateTime(ticks, DateTimeKind.Utc);
    }

    private static async Task<AgentInstance> GetAgentAsync(IDbContextFactory<AppDbContext> dbFactory, Guid agentId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstAsync(a => a.Id == agentId, ct);
        return agent;
    }

    private static async Task<List<Client>> LoadClientsAsync(IDbContextFactory<AppDbContext> dbFactory, Guid agentId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        return await db.Clients
            .Where(c => c.AgentId == agentId)
            .Include(c => c.Databases)
            .ToListAsync(ct);
    }

    private async Task<string?> GetClusterIdAsync(AgentInstance agent, CancellationToken ct)
    {
        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, ["cluster", "list"], ct);
        var list = RacOutputParser.ParseBlocks(outStr);
        if (list.Count == 0)
            return null;

        if (list[0].TryGetValue("cluster", out var clusterId) && !string.IsNullOrWhiteSpace(clusterId))
            return clusterId;

        return null;
    }

    private async Task<Dictionary<string, string>> GetInfobaseMapAsync(AgentInstance agent, string clusterId, CancellationToken ct)
    {
        var args = new List<string> { "infobase", "summary", "list", $"--cluster={clusterId}" };
        args.AddRange(BuildAuthArgs(agent));

        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, args, ct);
        var list = RacOutputParser.ParseBlocks(outStr);

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in list)
        {
            var uid = item.GetValueOrDefault("infobase")
                      ?? item.GetValueOrDefault("uuid")
                      ?? item.GetValueOrDefault("infobase_id");
            var name = item.GetValueOrDefault("name");
            if (!string.IsNullOrWhiteSpace(uid) && !string.IsNullOrWhiteSpace(name))
                map[uid] = name;
        }
        return map;
    }

    private async Task<List<SessionInfo>> GetSessionsAsync(
        AgentInstance agent,
        string clusterId,
        IReadOnlyDictionary<string, string> infobaseMap,
        CancellationToken ct)
    {
        var args = new List<string> { "session", "list", $"--cluster={clusterId}" };
        args.AddRange(BuildAuthArgs(agent));

        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, args, ct);
        var list = RacOutputParser.ParseBlocks(outStr);

        var sessions = new List<SessionInfo>(list.Count);
        foreach (var item in list)
        {
            var sessionId = item.GetValueOrDefault("session") ?? item.GetValueOrDefault("session_id");
            if (string.IsNullOrWhiteSpace(sessionId))
                continue;

            var appId = item.GetValueOrDefault("app_id") ?? "";
            if (appId is not ("1CV8" or "1CV8C" or "WebClient" or "App"))
                continue;

            var infobaseUuid = item.GetValueOrDefault("infobase") ?? item.GetValueOrDefault("infobase_id");
            var dbName = (infobaseUuid is not null && infobaseMap.TryGetValue(infobaseUuid, out var name))
                ? name
                : null;

            var startedAt = RacOutputParser.TryParseRacDateUtc(item.GetValueOrDefault("started_at")) ?? DateTime.UtcNow;
            var userName = item.GetValueOrDefault("user_name");

            sessions.Add(new SessionInfo(
                Id: sessionId,
                StartedAtUtc: startedAt,
                AppId: appId,
                InfobaseUuid: infobaseUuid,
                DatabaseName: dbName,
                UserName: userName));
        }

        return sessions;
    }

    private static Dictionary<Guid, int> ComputeClientSessionCounts(List<Client> clients, List<SessionInfo> sessions)
    {
        // Build dbName -> clientId map
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in clients)
        foreach (var db in c.Databases)
            map[db.Name] = c.Id;

        var counts = clients.ToDictionary(c => c.Id, _ => 0);

        foreach (var s in sessions)
        {
            if (s.DatabaseName is null) continue;
            if (!map.TryGetValue(s.DatabaseName, out var clientId)) continue;
            counts[clientId] = counts.GetValueOrDefault(clientId) + 1;
        }

        return counts;
    }

    private async Task EnforceLimitsAsync(
        AgentInstance agent,
        string clusterId,
        List<Client> clients,
        List<SessionInfo> sessions,
        Dictionary<Guid, int> counts,
        CancellationToken ct)
    {
        // Build dbName -> client map for quick routing
        var dbToClient = new Dictionary<string, Client>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in clients)
        foreach (var db in c.Databases)
            dbToClient[db.Name] = c;

        // Group sessions by client
        var sessionsByClient = new Dictionary<Guid, List<SessionInfo>>();
        foreach (var s in sessions)
        {
            if (s.DatabaseName is null) continue;
            if (!dbToClient.TryGetValue(s.DatabaseName, out var client)) continue;

            if (!sessionsByClient.TryGetValue(client.Id, out var list))
            {
                list = new List<SessionInfo>();
                sessionsByClient[client.Id] = list;
            }
            list.Add(s);
        }

        foreach (var client in clients)
        {
            if (!sessionsByClient.TryGetValue(client.Id, out var list) || list.Count == 0)
                continue;

            if (client.Status == ClientStatus.Blocked)
            {
                await KillSessionsAsync(agent, clusterId, client, list, reason: "Доступ заблокирован администратором.", ct);
                continue;
            }

            if (client.MaxSessions > 0 && counts.GetValueOrDefault(client.Id) > client.MaxSessions)
            {
                var excess = counts[client.Id] - client.MaxSessions;
                var toKill = list
                    .OrderByDescending(s => s.StartedAtUtc)
                    .Take(excess)
                    .ToList();

                await KillSessionsAsync(agent, clusterId, client, toKill, reason: "Лимит сеансов превышен. Обратитесь к администратору.", ct);
            }
        }
    }

    private async Task KillSessionsAsync(
        AgentInstance agent,
        string clusterId,
        Client client,
        List<SessionInfo> toKill,
        string reason,
        CancellationToken ct)
    {
        foreach (var s in toKill)
        {
            var ok = await TerminateSessionAsync(agent, clusterId, s.Id, reason, ct);
            // Log event (best effort)
            // Note: do not spam in loop too much; later we can batch.
            try
            {
                await WriteEventAsync(
                    dbFactory,
                    agent.Id,
                    ok ? EventLevel.Info : EventLevel.Warning,
                    ok
                        ? $"Сеанс завершен. Клиент: {client.Name}, База: {s.DatabaseName ?? "?"}, Пользователь: {s.UserName ?? "?"}"
                        : $"Не удалось завершить сеанс. Клиент: {client.Name}, SessionId: {s.Id}",
                    ct);
            }
            catch
            {
                // ignore
            }
        }
    }

    private async Task<bool> TerminateSessionAsync(
        AgentInstance agent,
        string clusterId,
        string sessionId,
        string? reason,
        CancellationToken ct)
    {
        var args = new List<string>
        {
            "session", "terminate",
            $"--cluster={clusterId}",
            $"--session={sessionId}"
        };

        if (!string.IsNullOrWhiteSpace(reason))
            args.Add($"--error-message={reason.Replace('\"', '\'')}");

        args.AddRange(BuildAuthArgs(agent));

        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, args, ct);
        return outStr is not null;
    }

    private IReadOnlyList<string> BuildAuthArgs(AgentInstance agent)
    {
        if (string.IsNullOrWhiteSpace(agent.ClusterUser))
            return Array.Empty<string>();

        var pwd = "";
        if (!string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
        {
            try
            {
                pwd = _protector.UnprotectFromBase64(agent.ClusterPassProtected);
            }
            catch
            {
                // If value is not protected (misconfiguration), fall back to raw (but this should not happen in production)
                pwd = agent.ClusterPassProtected;
            }
        }

        return
        [
            $"--cluster-user={agent.ClusterUser}",
            $"--cluster-pwd={pwd}"
        ];
    }

    private static async Task UpdateClusterStatusAsync(IDbContextFactory<AppDbContext> dbFactory, Guid agentId, ClusterStatus status, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstAsync(a => a.Id == agentId, ct);
        agent.LastKnownClusterStatus = status;
        agent.LastSeenAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static async Task WriteMetricBucketAsync(
        IDbContextFactory<AppDbContext> dbFactory,
        Guid agentId,
        ClusterStatus clusterStatus,
        int totalSessions,
        List<Client> clients,
        CancellationToken ct,
        Dictionary<Guid, int>? counts = null)
    {
        var now = DateTime.UtcNow;
        var bucketStart = RoundDownUtc(now, TimeSpan.FromMinutes(1));

        await using var db = await dbFactory.CreateDbContextAsync(ct);

        // Upsert agent bucket
        var agentBucket = await db.AgentMetricBuckets
            .FirstOrDefaultAsync(x => x.AgentId == agentId && x.BucketStartUtc == bucketStart, ct);
        if (agentBucket is null)
        {
            agentBucket = new AgentMetricBucket
            {
                AgentId = agentId,
                BucketStartUtc = bucketStart
            };
            db.AgentMetricBuckets.Add(agentBucket);
        }

        agentBucket.ClusterStatus = clusterStatus;
        agentBucket.TotalSessions = totalSessions;
        // CPU/RAM metrics are TODO (add later via PerformanceCounter/WMI)
        agentBucket.CpuPercent = 0;
        agentBucket.MemoryUsedMb = 0;
        agentBucket.MemoryTotalMb = 0;

        // Upsert per-client buckets
        foreach (var c in clients)
        {
            var active = counts?.GetValueOrDefault(c.Id) ?? 0;
            var row = await db.ClientMetricBuckets.FirstOrDefaultAsync(
                x => x.AgentId == agentId && x.BucketStartUtc == bucketStart && x.ClientId == c.Id, ct);
            if (row is null)
            {
                row = new ClientMetricBucket
                {
                    AgentId = agentId,
                    BucketStartUtc = bucketStart,
                    ClientId = c.Id
                };
                db.ClientMetricBuckets.Add(row);
            }

            row.ActiveSessions = active;
            row.MaxSessions = c.MaxSessions;
            row.Status = c.Status;
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task WriteMetricBucketSafeAsync(
        IDbContextFactory<AppDbContext> dbFactory,
        Guid agentId,
        ClusterStatus clusterStatus,
        int totalSessions,
        List<Client> clients,
        CancellationToken ct,
        Dictionary<Guid, int>? counts = null)
    {
        try
        {
            await WriteMetricBucketAsync(dbFactory, agentId, clusterStatus, totalSessions, clients, ct, counts);
        }
        catch
        {
            // ignore when DB is temporarily unavailable
        }
    }

    private readonly record struct SessionInfo(
        string Id,
        DateTime StartedAtUtc,
        string AppId,
        string? InfobaseUuid,
        string? DatabaseName,
        string? UserName);
}
