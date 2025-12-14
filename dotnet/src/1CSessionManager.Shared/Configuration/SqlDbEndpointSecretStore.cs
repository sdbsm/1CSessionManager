using System.Text.Json;
using SessionManager.Shared.Security;

namespace SessionManager.Shared.Configuration;

/// <summary>
/// Stores MSSQL endpoint settings (Server/Database/Encrypt/TrustServerCertificate) in Windows Credential Manager.
/// This is NOT a password, but keeps "all settings via UI" and avoids editing appsettings.json.
/// </summary>
public sealed class SqlDbEndpointSecretStore(WindowsCredentialStore credStore)
{
    public const string CredentialTarget = "1CSessionManager:SqlDbEndpoint";

    public bool IsSet => credStore.ReadSecret(CredentialTarget) is not null;

    public SqlLoginConnectionOptions? Read()
    {
        var json = credStore.ReadSecret(CredentialTarget);
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            return JsonSerializer.Deserialize<SqlLoginConnectionOptions>(json);
        }
        catch
        {
            return null;
        }
    }

    public void Write(SqlLoginConnectionOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.Server))
            throw new ArgumentException("Server is required.", nameof(options));
        if (string.IsNullOrWhiteSpace(options.Database))
            throw new ArgumentException("Database is required.", nameof(options));

        var json = JsonSerializer.Serialize(options);
        credStore.WriteSecret(CredentialTarget, json);
    }
}


