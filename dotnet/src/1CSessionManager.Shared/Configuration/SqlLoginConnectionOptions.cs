namespace SessionManager.Shared.Configuration;

public sealed class SqlLoginConnectionOptions
{
    public string Server { get; set; } = "localhost";
    public string Database { get; set; } = "OneCSessionManager";

    public bool TrustServerCertificate { get; set; } = true;
    public bool Encrypt { get; set; } = false;
}


