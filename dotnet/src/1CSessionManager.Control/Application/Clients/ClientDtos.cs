using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.Clients;

public sealed record ClientDatabaseDto(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("activeSessions")] int ActiveSessions);

public sealed record ClientDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("maxSessions")] int MaxSessions,
    [property: JsonPropertyName("databases")] ClientDatabaseDto[] Databases,
    [property: JsonPropertyName("activeSessions")] int ActiveSessions,
    [property: JsonPropertyName("status")] string Status);

public sealed record ClientDatabaseUpsertRequest([property: JsonPropertyName("name")] string Name);

public sealed record CreateClientRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("maxSessions")] int MaxSessions,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("databases")] ClientDatabaseUpsertRequest[]? Databases);

public sealed record UpdateClientRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("maxSessions")] int? MaxSessions,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("databases")] ClientDatabaseUpsertRequest[]? Databases);
