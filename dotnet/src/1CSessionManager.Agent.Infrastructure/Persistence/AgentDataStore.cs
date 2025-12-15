using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SessionManager.Agent.Monitoring;
using SessionManager.Agent.Ports;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Agent.Persistence;

public sealed class AgentDataStore(IDbContextFactory<AppDbContext> dbFactory) : IAgentDataStore
{
    public async Task UpsertAgentAsync(Guid agentId, CancellationToken ct)
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

    public async Task<AgentInstance> GetAgentAsync(Guid agentId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        return await db.Agents.FirstAsync(a => a.Id == agentId, ct);
    }

    public async Task<List<Client>> LoadClientsAsync(Guid agentId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        return await db.Clients
            .Where(c => c.AgentId == agentId)
            .Include(c => c.Databases)
            .ToListAsync(ct);
    }

    public async Task UpdateClusterStatusAsync(Guid agentId, ClusterStatus status, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstAsync(a => a.Id == agentId, ct);
        agent.LastKnownClusterStatus = status;
        agent.LastSeenAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task WriteEventAsync(
        Guid agentId, 
        EventLevel level, 
        string message, 
        CancellationToken ct,
        Guid? clientId = null,
        string? clientName = null,
        string? databaseName = null,
        string? sessionId = null,
        string? userName = null)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        db.Events.Add(new SystemEvent
        {
            AgentId = agentId,
            TimestampUtc = DateTime.UtcNow,
            Level = level,
            Message = message,
            ClientId = clientId,
            ClientName = clientName,
            DatabaseName = databaseName,
            SessionId = sessionId,
            UserName = userName
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task WriteMetricBucketSafeAsync(
        Guid agentId,
        ClusterStatus clusterStatus,
        int totalSessions,
        List<Client> clients,
        CancellationToken ct,
        Dictionary<Guid, ClientSessionStatsCalculator.ClientStats>? stats = null,
        SystemMetricsSnapshot? sys = null)
    {
        try
        {
            await WriteMetricBucketAsync(agentId, clusterStatus, totalSessions, clients, ct, stats, sys);
        }
        catch
        {
            // ignore when DB is temporarily unavailable
        }
    }

    private static DateTime RoundDownUtc(DateTime utc, TimeSpan interval)
    {
        var ticks = utc.Ticks - (utc.Ticks % interval.Ticks);
        return new DateTime(ticks, DateTimeKind.Utc);
    }

    private async Task WriteMetricBucketAsync(
        Guid agentId,
        ClusterStatus clusterStatus,
        int totalSessions,
        List<Client> clients,
        CancellationToken ct,
        Dictionary<Guid, ClientSessionStatsCalculator.ClientStats>? stats,
        SystemMetricsSnapshot? sys)
    {
        var now = DateTime.UtcNow;
        var bucketStart = RoundDownUtc(now, TimeSpan.FromMinutes(1));

        await using var db = await dbFactory.CreateDbContextAsync(ct);

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
        agentBucket.CpuPercent = sys?.CpuPercent ?? 0;
        agentBucket.MemoryUsedMb = sys?.MemoryUsedMb ?? 0;
        agentBucket.MemoryTotalMb = sys?.MemoryTotalMb ?? 0;
        agentBucket.DiskSpaceJson = sys?.DiskSpaceJson;

        foreach (var c in clients)
        {
            var st = stats?.GetValueOrDefault(c.Id);
            var active = st?.TotalSessions ?? 0;
            string? dbJson = st != null && st.DbCounts.Count > 0
                ? JsonSerializer.Serialize(st.DbCounts)
                : null;

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
            row.DatabaseMetricJson = dbJson;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<AgentCommand?> GetNextPendingCommandAsync(Guid agentId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var cmd = await db.AgentCommands
            .Where(x => x.AgentId == agentId && x.Status == "Pending")
            .OrderBy(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
        return cmd;
    }

    public async Task UpdateCommandStatusAsync(Guid commandId, string status, string? errorMessage, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var cmd = await db.AgentCommands.FirstOrDefaultAsync(x => x.Id == commandId, ct);
        if (cmd != null)
        {
            cmd.Status = status;
            cmd.ErrorMessage = errorMessage;
            cmd.ProcessedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task UpdateAgentMetadataAsync(Guid agentId, List<string> installedVersions, List<OneCPublication> publications, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.Include(a => a.Publications).FirstOrDefaultAsync(a => a.Id == agentId, ct);
        if (agent is null) return;

        // 1. Update installed versions
        var newJson = JsonSerializer.Serialize(installedVersions);
        if (agent.InstalledVersionsJson != newJson)
        {
            agent.InstalledVersionsJson = newJson;
            agent.LastSeenAtUtc = DateTime.UtcNow;
        }

        // 2. Update publications
        // We sync by SiteName+AppPath
        var now = DateTime.UtcNow;
        var existing = agent.Publications.ToList(); // Load into memory
        
        var touchedIds = new HashSet<Guid>();

        foreach (var p in publications)
        {
            var match = existing.FirstOrDefault(x => 
                x.SiteName.Equals(p.SiteName, StringComparison.OrdinalIgnoreCase) && 
                x.AppPath.Equals(p.Path, StringComparison.OrdinalIgnoreCase));

            if (match == null)
            {
                match = new AgentPublication
                {
                    AgentId = agentId,
                    SiteName = p.SiteName,
                    AppPath = p.Path
                };
                db.AgentPublications.Add(match);
            }

            match.PhysicalPath = p.PhysicalPath;
            match.Version = string.IsNullOrWhiteSpace(p.CurrentVersionBinPath) 
                ? null 
                : ExtractVersionFromBinPath(p.CurrentVersionBinPath);
            match.LastDetectedAtUtc = now;
            
            touchedIds.Add(match.Id);
        }

        // Optional: Remove stale publications (not detected anymore)?
        // For safety, let's just leave them but maybe mark detected time. 
        // Or if we are sure, delete them. Given user asked for "scan", let's remove missing ones to keep list clean.
        foreach (var ex in existing)
        {
            // If it was already persisted (Id != empty) and not in current batch
            if (ex.Id != Guid.Empty && !touchedIds.Contains(ex.Id))
            {
                db.AgentPublications.Remove(ex);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static string? ExtractVersionFromBinPath(string binPath)
    {
        // binPath is typically .../8.3.24.1342/bin
        // or .../8.3.24.1342
        var dir = new DirectoryInfo(binPath);
        if (dir.Name.Equals("bin", StringComparison.OrdinalIgnoreCase))
        {
            return dir.Parent?.Name;
        }
        return dir.Name;
    }
}
