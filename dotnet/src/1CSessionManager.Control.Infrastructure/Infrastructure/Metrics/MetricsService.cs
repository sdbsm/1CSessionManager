using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Application.Metrics;
using SessionManager.Shared.Data;

namespace SessionManager.Control.Infrastructure.Metrics;

public sealed class MetricsService(IDbContextFactory<AppDbContext> dbFactory) : IMetricsService
{
    public async Task<IReadOnlyList<AgentMetricBucketDto>> GetAgentMetricsAsync(
        Guid agentId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int? take,
        CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);

        var q = db.AgentMetricBuckets.AsNoTracking().Where(x => x.AgentId == agentId);
        if (fromUtc is not null) q = q.Where(x => x.BucketStartUtc >= fromUtc.Value);
        if (toUtc is not null) q = q.Where(x => x.BucketStartUtc <= toUtc.Value);

        var limit = Math.Clamp(take ?? 1440, 1, 20000);

        return await q
            .OrderByDescending(x => x.BucketStartUtc)
            .Take(limit)
            .Select(x => new AgentMetricBucketDto(
                x.Id,
                x.AgentId,
                x.BucketStartUtc,
                x.ClusterStatus,
                x.CpuPercent,
                x.MemoryUsedMb,
                x.MemoryTotalMb,
                x.DiskSpaceJson,
                x.TotalSessions))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ClientMetricBucketDto>> GetClientMetricsAsync(
        Guid agentId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int? take,
        CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);

        var q = db.ClientMetricBuckets.AsNoTracking().Where(x => x.AgentId == agentId);
        if (fromUtc is not null) q = q.Where(x => x.BucketStartUtc >= fromUtc.Value);
        if (toUtc is not null) q = q.Where(x => x.BucketStartUtc <= toUtc.Value);

        var limit = Math.Clamp(take ?? 5000, 1, 50000);

        return await q
            .OrderByDescending(x => x.BucketStartUtc)
            .Take(limit)
            .Select(x => new ClientMetricBucketDto(
                x.Id,
                x.AgentId,
                x.BucketStartUtc,
                x.ClientId,
                x.ActiveSessions,
                x.MaxSessions,
                x.Status,
                x.DatabaseMetricJson))
            .ToListAsync(ct);
    }
}
