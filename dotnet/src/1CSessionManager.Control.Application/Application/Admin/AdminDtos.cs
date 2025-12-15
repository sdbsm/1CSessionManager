using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.Admin;

public sealed record ApiKeyStatusDto([property: JsonPropertyName("isSet")] bool IsSet);

public sealed record LicensesStatusDto(
    [property: JsonPropertyName("isSet")] bool IsSet,
    [property: JsonPropertyName("total")] int? Total);

public sealed record ApiKeySetRequest([property: JsonPropertyName("apiKey")] string ApiKey);

public sealed record LicensesSetRequest([property: JsonPropertyName("total")] int Total);
