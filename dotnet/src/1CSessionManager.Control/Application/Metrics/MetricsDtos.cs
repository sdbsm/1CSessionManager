using System.Text.Json.Serialization;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Control.Application.Metrics;

public sealed record AgentMetricBucketDto(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("agentId")] Guid AgentId,
    [property: JsonPropertyName("bucketStartUtc")] DateTime BucketStartUtc,
    [property: JsonPropertyName("clusterStatus")] ClusterStatus ClusterStatus,
    [property: JsonPropertyName("cpuPercent")] short CpuPercent,
    [property: JsonPropertyName("memoryUsedMb")] int MemoryUsedMb,
    [property: JsonPropertyName("memoryTotalMb")] int MemoryTotalMb,
    [property: JsonPropertyName("diskSpaceJson")] string? DiskSpaceJson,
    [property: JsonPropertyName("totalSessions")] int TotalSessions);

public sealed record ClientMetricBucketDto(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("agentId")] Guid AgentId,
    [property: JsonPropertyName("bucketStartUtc")] DateTime BucketStartUtc,
    [property: JsonPropertyName("clientId")] Guid ClientId,
    [property: JsonPropertyName("activeSessions")] int ActiveSessions,
    [property: JsonPropertyName("maxSessions")] int MaxSessions,
    [property: JsonPropertyName("status")] ClientStatus Status,
    [property: JsonPropertyName("databaseMetricJson")] string? DatabaseMetricJson);
