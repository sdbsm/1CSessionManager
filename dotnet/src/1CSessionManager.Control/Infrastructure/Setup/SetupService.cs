using Microsoft.Extensions.Options;
using SessionManager.Control.Application.Setup;
using SessionManager.Shared.Configuration;

namespace SessionManager.Control.Infrastructure.Setup;

public sealed class SetupService(
    SqlDbEndpointSecretStore endpointStore,
    IOptions<SqlLoginConnectionOptions> fallback,
    SqlLoginSecretStore sqlLoginStore,
    SqlLoginConnectionStringProvider csProvider) : ISetupService
{
    public DbEndpointStatusDto GetDbEndpointStatus()
    {
        var val = endpointStore.Read() ?? fallback.Value;
        return new DbEndpointStatusDto(
            IsSet: endpointStore.IsSet,
            Value: new SqlDbEndpointDto(
                Server: val.Server,
                Database: val.Database,
                TrustServerCertificate: val.TrustServerCertificate,
                Encrypt: val.Encrypt));
    }

    public void SetDbEndpoint(SqlDbEndpointSetRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Server) || string.IsNullOrWhiteSpace(req.Database))
            throw new ArgumentException("Server and Database are required.");

        endpointStore.Write(new SqlLoginConnectionOptions
        {
            Server = req.Server.Trim(),
            Database = req.Database.Trim(),
            TrustServerCertificate = req.TrustServerCertificate ?? true,
            Encrypt = req.Encrypt ?? false
        });
    }

    public SqlLoginStatusDto GetSqlLoginStatus()
        => new(sqlLoginStore.Read() is not null);

    public void SetSqlLogin(SqlSetupRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserId) || string.IsNullOrWhiteSpace(req.Password))
            throw new ArgumentException("UserId and Password are required.");

        sqlLoginStore.Write(req.UserId.Trim(), req.Password);
    }

    public async Task<SqlTestResponseDto> TestSqlAsync(CancellationToken ct)
    {
        try
        {
            var cs = csProvider.BuildOrThrow();
            await using var conn = new Microsoft.Data.SqlClient.SqlConnection(cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT @@VERSION";
            var version = (string?)await cmd.ExecuteScalarAsync(ct);

            return new SqlTestResponseDto(true, version ?? "Unknown", null);
        }
        catch (Exception ex)
        {
            return new SqlTestResponseDto(false, null, ex.Message);
        }
    }
}
