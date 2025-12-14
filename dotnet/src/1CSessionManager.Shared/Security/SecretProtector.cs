using System.Security.Cryptography;
using System.Text;

namespace SessionManager.Shared.Security;

/// <summary>
/// DPAPI protector (LocalMachine). Designed to store secrets in DB without plaintext.
/// </summary>
public sealed class SecretProtector
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("1CSessionManager::entropy::v1");

    public string ProtectToBase64(string plainText)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("DPAPI is supported only on Windows.");

        var bytes = Encoding.UTF8.GetBytes(plainText);
        var protectedBytes = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.LocalMachine);
        return Convert.ToBase64String(protectedBytes);
    }

    public string UnprotectFromBase64(string base64Protected)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("DPAPI is supported only on Windows.");

        var protectedBytes = Convert.FromBase64String(base64Protected);
        var bytes = ProtectedData.Unprotect(protectedBytes, Entropy, DataProtectionScope.LocalMachine);
        return Encoding.UTF8.GetString(bytes);
    }
}


