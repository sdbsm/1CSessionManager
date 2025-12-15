using System.Security.Cryptography;
using System.Text;

namespace SessionManager.Control.Api.Security;

public static class ApiKeyComparer
{
    public static bool FixedTimeEquals(string? provided, string expected)
    {
        var a = Encoding.UTF8.GetBytes(provided ?? string.Empty);
        var b = Encoding.UTF8.GetBytes(expected);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
}
