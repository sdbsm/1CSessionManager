using Microsoft.Extensions.Caching.Memory;
using SessionManager.Control.Application.Dashboard;

namespace SessionManager.Control.Api.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/dashboard/stats", async (
            IDashboardService dashboard,
            IMemoryCache cache,
            CancellationToken ct) =>
        {
            // Cheap in-memory cache (UI polls every 10s; this avoids accidental double-hit)
            var cached = await cache.GetOrCreateAsync(DashboardCacheKeys.Stats, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(5);
                return await dashboard.GetStatsAsync(ct);
            });

            return Results.Ok(cached);
        });

        endpoints.MapGet("/api/dashboard/top-clients", async (IDashboardInsightsService insights, CancellationToken ct) =>
        {
            var top = await insights.GetTopClientsAsync(ct);
            return Results.Ok(top);
        });

        endpoints.MapGet("/api/dashboard/warnings", async (IDashboardInsightsService insights, CancellationToken ct) =>
        {
            var warnings = await insights.GetWarningsAsync(ct);
            return Results.Ok(warnings);
        });

        return endpoints;
    }
}
