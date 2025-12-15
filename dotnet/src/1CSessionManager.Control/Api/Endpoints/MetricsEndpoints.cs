using SessionManager.Control.Application.Metrics;

namespace SessionManager.Control.Api.Endpoints;

public static class MetricsEndpoints
{
    public static IEndpointRouteBuilder MapMetricsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Metrics (minute buckets)
        endpoints.MapGet("/api/metrics/agent", async (
            Guid agentId,
            DateTime? fromUtc,
            DateTime? toUtc,
            int? take,
            IMetricsService metrics,
            CancellationToken ct) =>
        {
            var items = await metrics.GetAgentMetricsAsync(agentId, fromUtc, toUtc, take, ct);
            return Results.Ok(items);
        });

        endpoints.MapGet("/api/metrics/clients", async (
            Guid agentId,
            DateTime? fromUtc,
            DateTime? toUtc,
            int? take,
            IMetricsService metrics,
            CancellationToken ct) =>
        {
            var items = await metrics.GetClientMetricsAsync(agentId, fromUtc, toUtc, take, ct);
            return Results.Ok(items);
        });

        return endpoints;
    }
}
