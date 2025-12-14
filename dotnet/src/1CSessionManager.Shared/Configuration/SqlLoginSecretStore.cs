using System.Text.Json;
using SessionManager.Shared.Security;

namespace SessionManager.Shared.Configuration;

/// <summary>
/// Stores SQL login credentials in Windows Credential Manager.
/// </summary>
public sealed class SqlLoginSecretStore(WindowsCredentialStore credStore)
{
    public const string CredentialTarget = "1CSessionManager:SqlLogin";

    public bool IsSet => credStore.ReadSecret(CredentialTarget) is not null;

    public (string UserId, string Password)? Read()
    {
        var json = credStore.ReadSecret(CredentialTarget);
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            var obj = JsonSerializer.Deserialize<SqlCred>(json);
            if (obj is null || string.IsNullOrWhiteSpace(obj.UserId) || string.IsNullOrWhiteSpace(obj.Password))
                return null;
            return (obj.UserId, obj.Password);
        }
        catch
        {
            return null;
        }
    }

    public void Write(string userId, string password)
    {
        var json = JsonSerializer.Serialize(new SqlCred(userId, password));
        credStore.WriteSecret(CredentialTarget, json);
    }

    private sealed record SqlCred(string UserId, string Password);
}


