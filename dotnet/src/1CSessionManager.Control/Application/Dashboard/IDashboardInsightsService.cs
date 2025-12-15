namespace SessionManager.Control.Application.Dashboard;

public interface IDashboardInsightsService
{
    Task<IReadOnlyList<DashboardTopClientDto>> GetTopClientsAsync(CancellationToken ct);
    Task<IReadOnlyList<DashboardWarningDto>> GetWarningsAsync(CancellationToken ct);
}
