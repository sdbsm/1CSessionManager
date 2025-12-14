using SessionManager.Shared.Data.Enums;

namespace SessionManager.Shared.Data.Entities;

/// <summary>
/// Агент, установленный на сервере 1С. В перспективе таких агентов будет несколько.
/// </summary>
public sealed class AgentInstance
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;
    public string Hostname { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }

    // RAC / RAS settings
    public string RacPath { get; set; } = null!;
    public string RasHost { get; set; } = null!;
    public string? ClusterUser { get; set; }
    public string? ClusterPassProtected { get; set; }

    // Policy
    public bool KillModeEnabled { get; set; }
    public int PollIntervalSeconds { get; set; }

    public bool Enabled { get; set; }
    public ClusterStatus LastKnownClusterStatus { get; set; }
}


