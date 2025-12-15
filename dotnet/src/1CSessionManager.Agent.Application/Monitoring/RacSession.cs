namespace SessionManager.Agent.Monitoring;

public readonly record struct RacSession(
    string Id,
    DateTime StartedAtUtc,
    string AppId,
    string? InfobaseUuid,
    string? DatabaseName,
    string? UserName);
