namespace SessionManager.Control.Application.Setup;

public interface ISetupService
{
    DbEndpointStatusDto GetDbEndpointStatus();
    void SetDbEndpoint(SqlDbEndpointSetRequest req);

    SqlLoginStatusDto GetSqlLoginStatus();
    void SetSqlLogin(SqlSetupRequest req);

    Task<SqlTestResponseDto> TestSqlAsync(CancellationToken ct);
}
