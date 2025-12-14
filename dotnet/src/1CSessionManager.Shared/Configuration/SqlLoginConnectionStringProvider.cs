using Microsoft.Extensions.Options;
using SessionManager.Shared.Security;
using System.Text;

namespace SessionManager.Shared.Configuration;

public sealed class SqlLoginConnectionStringProvider(
    IOptions<SqlLoginConnectionOptions> options,
    SqlLoginSecretStore secrets,
    SqlDbEndpointSecretStore endpointStore)
{
    public bool IsConfigured => secrets.Read() is not null;

    public string BuildOrThrow()
    {
        var cred = secrets.Read();
        if (cred is null)
            throw new InvalidOperationException("SQL login is not configured. Set it via web setup.");

        var o = endpointStore.Read() ?? options.Value;
        var sb = new StringBuilder();
        sb.Append("Server=").Append(o.Server).Append(';');
        sb.Append("Database=").Append(o.Database).Append(';');
        sb.Append("User Id=").Append(cred.Value.UserId).Append(';');
        sb.Append("Password=").Append(cred.Value.Password).Append(';');
        sb.Append("TrustServerCertificate=").Append(o.TrustServerCertificate ? "True" : "False").Append(';');
        sb.Append("Encrypt=").Append(o.Encrypt ? "True" : "False").Append(';');
        return sb.ToString();
    }
}


