using Microsoft.EntityFrameworkCore;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Security;

namespace SessionManager.Control.Services;

public sealed class AppSecretService(
    IDbContextFactory<AppDbContext> dbFactory,
    SecretProtector protector)
{
    public const string ApiKeySecretKey = "auth.apiKey";

    public async Task<string?> GetPlainAsync(string key, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var row = await db.AppSecrets.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key, ct);
        if (row is null) return null;
        return protector.UnprotectFromBase64(row.ProtectedValueBase64);
    }

    public async Task SetPlainAsync(string key, string plainValue, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var row = await db.AppSecrets.FirstOrDefaultAsync(x => x.Key == key, ct);
        if (row is null)
        {
            row = new AppSecret { Key = key };
            db.AppSecrets.Add(row);
        }

        row.ProtectedValueBase64 = protector.ProtectToBase64(plainValue);
        row.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}


