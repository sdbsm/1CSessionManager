using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Application.Dashboard;
using SessionManager.Control.Infrastructure.Agents;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Control.Infrastructure.Dashboard;

public sealed class DashboardInsightsService(IDbContextFactory<AppDbContext> dbFactory) : IDashboardInsightsService
{
    public async Task<IReadOnlyList<DashboardTopClientDto>> GetTopClientsAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null) return Array.Empty<DashboardTopClientDto>();

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var clients = await db.Clients.Where(c => c.AgentId == agentId.Value).ToListAsync(ct);

        var latestBucketTime = await db.ClientMetricBuckets
            .Where(x => x.AgentId == agentId.Value)
            .MaxAsync(x => (DateTime?)x.BucketStartUtc, ct);

        Dictionary<Guid, int> activeMap = new();
        if (latestBucketTime is not null)
        {
            activeMap = await db.ClientMetricBuckets.AsNoTracking()
                .Where(x => x.AgentId == agentId.Value && x.BucketStartUtc == latestBucketTime.Value)
                .ToDictionaryAsync(x => x.ClientId, x => x.ActiveSessions, ct);
        }

        return clients
            .Where(c => c.MaxSessions > 0)
            .Select(c =>
            {
                var active = activeMap.GetValueOrDefault(c.Id, 0);
                var util = c.MaxSessions > 0 ? (int)Math.Round((double)active / c.MaxSessions * 100) : 0;

                return new DashboardTopClientDto(
                    Id: c.Id.ToString("D"),
                    Name: c.Name,
                    ActiveSessions: active,
                    MaxSessions: c.MaxSessions,
                    Utilization: util,
                    Status: ToApiClientStatus(c.Status));
            })
            .OrderByDescending(x => x.ActiveSessions)
            .Take(5)
            .ToArray();
    }

    public async Task<IReadOnlyList<DashboardWarningDto>> GetWarningsAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null) return Array.Empty<DashboardWarningDto>();

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var clients = await db.Clients.Where(c => c.AgentId == agentId.Value).ToListAsync(ct);

        var latestBucketTime = await db.ClientMetricBuckets
            .Where(x => x.AgentId == agentId.Value)
            .MaxAsync(x => (DateTime?)x.BucketStartUtc, ct);

        Dictionary<Guid, int> activeMap = new();
        if (latestBucketTime is not null)
        {
            activeMap = await db.ClientMetricBuckets.AsNoTracking()
                .Where(x => x.AgentId == agentId.Value && x.BucketStartUtc == latestBucketTime.Value)
                .ToDictionaryAsync(x => x.ClientId, x => x.ActiveSessions, ct);
        }

        return clients
            .Select(c =>
            {
                var active = activeMap.GetValueOrDefault(c.Id, 0);
                var util = c.MaxSessions > 0 ? (int)Math.Round((double)active / c.MaxSessions * 100) : 0;

                var warn = c.Status == ClientStatus.Blocked || (c.MaxSessions > 0 && util >= 80);
                if (!warn) return null;

                var reason = c.Status == ClientStatus.Blocked
                    ? "Заблокирован"
                    : (util >= 100 ? "Лимит превышен" : "Высокая загрузка (>80%)");

                return new DashboardWarningDto(
                    Id: c.Id.ToString("D"),
                    Name: c.Name,
                    ActiveSessions: active,
                    MaxSessions: c.MaxSessions,
                    Utilization: util,
                    Status: ToApiClientStatus(c.Status),
                    Reason: reason);
            })
            .Where(x => x is not null)
            .Select(x => x!)
            .ToArray();
    }

    private static string ToApiClientStatus(ClientStatus status) => status switch
    {
        ClientStatus.Active => "active",
        ClientStatus.Warning => "warning",
        ClientStatus.Blocked => "blocked",
        _ => "active"
    };
}
