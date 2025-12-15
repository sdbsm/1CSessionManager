using System.Text.Json.Serialization;

namespace SessionManager.Control.Application.OneC;

public static class OneCConstants
{
    public const string EncryptedPlaceholder = "***ENCRYPTED***";
}

public sealed record LegacySettingsDto(
    [property: JsonPropertyName("racPath")] string RacPath,
    [property: JsonPropertyName("rasHost")] string RasHost,
    [property: JsonPropertyName("clusterUser")] string ClusterUser,
    [property: JsonPropertyName("clusterPass")] string ClusterPass,
    [property: JsonPropertyName("checkInterval")] int CheckInterval,
    [property: JsonPropertyName("killMode")] bool KillMode);

public sealed record LegacySettingsUpdateRequest(
    [property: JsonPropertyName("racPath")] string? RacPath,
    [property: JsonPropertyName("rasHost")] string? RasHost,
    [property: JsonPropertyName("clusterUser")] string? ClusterUser,
    [property: JsonPropertyName("clusterPass")] string? ClusterPass,
    [property: JsonPropertyName("checkInterval")] int? CheckInterval,
    [property: JsonPropertyName("killMode")] bool? KillMode);

public sealed record TestConnectionRequest(
    [property: JsonPropertyName("racPath")] string? RacPath,
    [property: JsonPropertyName("rasHost")] string? RasHost,
    [property: JsonPropertyName("clusterUser")] string? ClusterUser,
    [property: JsonPropertyName("clusterPass")] string? ClusterPass);

public sealed record TestConnectionResponse(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("output")] string? Output,
    [property: JsonPropertyName("error")] string? Error);

public sealed record ServerInfoDto(
    [property: JsonPropertyName("hostname")] string Hostname,
    [property: JsonPropertyName("osVersion")] string OsVersion);

public sealed record InfobaseDto(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("uuid")] string Uuid);
