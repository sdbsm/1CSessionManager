namespace SessionManager.Control.Application.Metrics;

public interface IMetricsService
{
    Task<IReadOnlyList<AgentMetricBucketDto>> GetAgentMetricsAsync(Guid agentId, DateTime? fromUtc, DateTime? toUtc, int? take, CancellationToken ct);
    Task<IReadOnlyList<ClientMetricBucketDto>> GetClientMetricsAsync(Guid agentId, DateTime? fromUtc, DateTime? toUtc, int? take, CancellationToken ct);
}
