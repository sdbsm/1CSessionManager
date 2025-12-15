using SessionManager.Agent.Monitoring;
using SessionManager.Shared.Data.Entities;

namespace SessionManager.Agent.Ports;

public interface IRacSessionClient
{
    Task<string?> GetClusterIdAsync(AgentInstance agent, CancellationToken ct);

    Task<Dictionary<string, string>> GetInfobaseMapAsync(AgentInstance agent, string clusterId, CancellationToken ct);

    Task<List<RacSession>> GetSessionsAsync(
        AgentInstance agent,
        string clusterId,
        IReadOnlyDictionary<string, string> infobaseMap,
        CancellationToken ct);

    Task<bool> TerminateSessionAsync(
        AgentInstance agent,
        string clusterId,
        string sessionId,
        string? reason,
        CancellationToken ct);
}
