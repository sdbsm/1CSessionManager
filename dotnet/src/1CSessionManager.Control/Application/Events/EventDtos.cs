using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.Events;

public sealed record SystemEventDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("timestampUtc")] string TimestampUtc,
    [property: JsonPropertyName("timestampLocal")] string TimestampLocal,
    [property: JsonPropertyName("level")] string Level,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("clientId")] string? ClientId,
    [property: JsonPropertyName("clientName")] string? ClientName,
    [property: JsonPropertyName("databaseName")] string? DatabaseName,
    [property: JsonPropertyName("sessionId")] string? SessionId,
    [property: JsonPropertyName("userName")] string? UserName);

public sealed record ListEventsRequest(
    Guid? AgentId,
    DateTime? FromUtc,
    DateTime? ToUtc,
    string? Levels,
    string? Q,
    string? ClientId,
    string? Database,
    string? User,
    int? Take);
