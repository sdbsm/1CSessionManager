namespace SessionManager.Control.Application.Admin;

public interface IAdminConfigService
{
    Task<ApiKeyStatusDto> GetApiKeyStatusAsync(CancellationToken ct);
    Task<string?> GetApiKeyPlainAsync(CancellationToken ct);
    Task SetApiKeyAsync(string apiKey, CancellationToken ct);

    Task<LicensesStatusDto> GetLicensesStatusAsync(CancellationToken ct);
    Task SetLicensesTotalAsync(int total, CancellationToken ct);
}
