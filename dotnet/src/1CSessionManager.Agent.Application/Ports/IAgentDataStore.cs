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
    
    Task WriteEventAsync(
        Guid agentId, 
        EventLevel level, 
        string message, 
        CancellationToken ct,
        Guid? clientId = null,
        string? clientName = null,
        string? databaseName = null,
        string? sessionId = null,
        string? userName = null);

    Task WriteMetricBucketSafeAsync(
        Guid agentId,
        ClusterStatus clusterStatus,
        int totalSessions,
        List<Client> clients,
        CancellationToken ct,
        Dictionary<Guid, ClientSessionStatsCalculator.ClientStats>? stats = null,
        SystemMetricsSnapshot? sys = null);

    Task<AgentCommand?> GetNextPendingCommandAsync(Guid agentId, CancellationToken ct);
    Task UpdateCommandStatusAsync(Guid commandId, string status, string? errorMessage, CancellationToken ct);
    Task UpdateCommandProgressAsync(Guid commandId, int? progressPercent, string? progressMessage, CancellationToken ct);

    Task UpdateAgentMetadataAsync(Guid agentId, List<string> installedVersions, List<OneCPublication> publications, CancellationToken ct);
}
