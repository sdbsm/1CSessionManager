using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.Dashboard;

public sealed record DashboardTopClientDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("activeSessions")] int ActiveSessions,
    [property: JsonPropertyName("maxSessions")] int MaxSessions,
    [property: JsonPropertyName("utilization")] int Utilization,
    [property: JsonPropertyName("status")] string Status);

public sealed record DashboardWarningDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("activeSessions")] int ActiveSessions,
    [property: JsonPropertyName("maxSessions")] int MaxSessions,
    [property: JsonPropertyName("utilization")] int Utilization,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("reason")] string Reason);
