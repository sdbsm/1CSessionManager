using System.Text.Json;
using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.Dashboard;

public sealed record DashboardStatsDto(
    [property: JsonPropertyName("databaseStats")] IReadOnlyDictionary<string, DatabaseStatsDto> DatabaseStats,
    [property: JsonPropertyName("totalDatabases")] int TotalDatabases,
    [property: JsonPropertyName("connectionTypes")] IReadOnlyDictionary<string, int> ConnectionTypes,
    [property: JsonPropertyName("clusterStatus")] string ClusterStatus,
    [property: JsonPropertyName("serverMetrics")] ServerMetricsDto ServerMetrics,
    [property: JsonPropertyName("lastUpdate")] string? LastUpdate,
    [property: JsonPropertyName("debug")] DashboardDebugDto? Debug);

public sealed record DatabaseStatsDto(
    [property: JsonPropertyName("sessions")] int Sessions,
    [property: JsonPropertyName("sizeMB")] decimal? SizeMB);

public sealed record ServerMetricsDto(
    [property: JsonPropertyName("cpu")] int Cpu,
    [property: JsonPropertyName("memory")] MemoryMetricsDto Memory,
    [property: JsonPropertyName("disks")] JsonElement? Disks);

public sealed record MemoryMetricsDto(
    [property: JsonPropertyName("used")] int Used,
    [property: JsonPropertyName("total")] int Total,
    [property: JsonPropertyName("percent")] int Percent);

public sealed record DashboardDebugDto(
    [property: JsonPropertyName("error")] string? Error,
    [property: JsonPropertyName("info")] IReadOnlyDictionary<string, object?> Info);
