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

    public async Task WriteEventAsync(Guid agentId, EventLevel level, string message, CancellationToken ct)
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
}
