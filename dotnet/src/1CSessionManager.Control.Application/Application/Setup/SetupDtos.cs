using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.Setup;

public sealed record SqlDbEndpointDto(
    [property: JsonPropertyName("server")] string Server,
    [property: JsonPropertyName("database")] string Database,
    [property: JsonPropertyName("trustServerCertificate")] bool TrustServerCertificate,
    [property: JsonPropertyName("encrypt")] bool Encrypt);

public sealed record DbEndpointStatusDto(
    [property: JsonPropertyName("isSet")] bool IsSet,
    [property: JsonPropertyName("value")] SqlDbEndpointDto Value);

public sealed record SqlLoginStatusDto([property: JsonPropertyName("isSet")] bool IsSet);

public sealed record SqlTestResponseDto(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("version")] string? Version,
    [property: JsonPropertyName("error")] string? Error);

public sealed record SqlSetupRequest(
    [property: JsonPropertyName("userId")] string UserId,
    [property: JsonPropertyName("password")] string Password);

public sealed record SqlDbEndpointSetRequest(
    [property: JsonPropertyName("server")] string Server,
    [property: JsonPropertyName("database")] string Database,
    [property: JsonPropertyName("trustServerCertificate")] bool? TrustServerCertificate,
    [property: JsonPropertyName("encrypt")] bool? Encrypt);
