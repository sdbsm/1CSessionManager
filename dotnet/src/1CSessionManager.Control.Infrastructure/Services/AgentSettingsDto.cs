namespace SessionManager.Control.Services;

public sealed record AgentSettingsResponse(
    Guid AgentId,
    bool Enabled,
    string RacPath,
    string RasHost,
    string? ClusterUser,
    bool ClusterPassIsSet,
    bool KillModeEnabled,
    int PollIntervalSeconds
);

public sealed record AgentSettingsUpdateRequest(
    bool? Enabled,
    string? RacPath,
    string? RasHost,
    string? ClusterUser,
    string? ClusterPass, // plain text; will be stored DPAPI protected
    bool? KillModeEnabled,
    int? PollIntervalSeconds
);


