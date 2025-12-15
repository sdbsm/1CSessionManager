using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using SessionManager.Control.Application.Admin;
using SessionManager.Control.Services;

namespace SessionManager.Control.Infrastructure.Admin;

public sealed class AdminConfigService(AppSecretService secrets, IMemoryCache cache) : IAdminConfigService
{
    public async Task<ApiKeyStatusDto> GetApiKeyStatusAsync(CancellationToken ct)
    {
        try
        {
            var apiKey = await secrets.GetPlainAsync(AppSecretService.ApiKeySecretKey, ct);
            return new ApiKeyStatusDto(!string.IsNullOrWhiteSpace(apiKey));
        }
        catch
        {
            return new ApiKeyStatusDto(false);
        }
    }

    public async Task<string?> GetApiKeyPlainAsync(CancellationToken ct)
    {
        try
        {
            return await secrets.GetPlainAsync(AppSecretService.ApiKeySecretKey, ct);
        }
        catch
        {
            return null;
        }
    }

    public async Task SetApiKeyAsync(string apiKey, CancellationToken ct)
    {
        await secrets.SetPlainAsync(AppSecretService.ApiKeySecretKey, apiKey, ct);
        cache.Set("auth.apiKey", apiKey, TimeSpan.FromMinutes(5));
    }

    public async Task<LicensesStatusDto> GetLicensesStatusAsync(CancellationToken ct)
    {
        var raw = await secrets.GetPlainAsync(AppSecretService.LicensesTotalKey, ct);
        var ok = int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var total);
        if (!ok || total <= 0) return new LicensesStatusDto(false, null);
        return new LicensesStatusDto(true, total);
    }

    public async Task SetLicensesTotalAsync(int total, CancellationToken ct)
    {
        await secrets.SetPlainAsync(AppSecretService.LicensesTotalKey, total.ToString(CultureInfo.InvariantCulture), ct);
    }
}
