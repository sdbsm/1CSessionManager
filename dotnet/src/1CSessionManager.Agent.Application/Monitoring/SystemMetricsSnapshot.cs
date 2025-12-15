namespace SessionManager.Agent.Monitoring;

public readonly record struct SystemMetricsSnapshot(
    short CpuPercent,
    int MemoryUsedMb,
    int MemoryTotalMb,
    string? DiskSpaceJson);
