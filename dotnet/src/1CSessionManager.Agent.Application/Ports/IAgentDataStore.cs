using SessionManager.Agent.Monitoring;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Agent.Ports;

public interface IAgentDataStore
{
    Task UpsertAgentAsync(Guid agentId, CancellationToken ct);
    Task<AgentInstance> GetAgentAsync(Guid agentId, CancellationToken ct);
    Task<List<Client>> LoadClientsAsync(Guid agentId, CancellationToken ct);

    Task UpdateClusterStatusAsync(Guid agentId, ClusterStatus status, CancellationToken ct);
    Task WriteEventAsync(Guid agentId, EventLevel level, string message, CancellationToken ct);

    Task WriteMetricBucketSafeAsync(
        Guid agentId,
        ClusterStatus clusterStatus,
        int totalSessions,
        List<Client> clients,
        CancellationToken ct,
        Dictionary<Guid, ClientSessionStatsCalculator.ClientStats>? stats = null,
        SystemMetricsSnapshot? sys = null);
}
