using System.Net;

namespace SessionManager.Control.Api.Http;

public static class RequestOrigin
{
    public static bool IsLocalhost(HttpContext http)
    {
        var ip = http.Connection.RemoteIpAddress;
        return ip is not null && IPAddress.IsLoopback(ip);
    }
}
