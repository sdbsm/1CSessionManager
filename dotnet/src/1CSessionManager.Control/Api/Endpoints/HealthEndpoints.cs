using System.Reflection;
using Microsoft.EntityFrameworkCore;
using SessionManager.Shared.Data;

namespace SessionManager.Control.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/health", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
        {
            // NOTE: health is allowed without API key. Keep response minimal (no connection strings / hostnames / secrets).
            var utc = DateTime.UtcNow;
            var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";

            var db = "unknown";
            try
            {
                await using var ctx = await dbFactory.CreateDbContextAsync(ct);
                db = await ctx.Database.CanConnectAsync(ct) ? "ok" : "down";
            }
            catch
            {
                db = "down";
            }

            return Results.Ok(new
            {
                status = "ok",
                utc,
                version,
                db
            });
        });

        return endpoints;
    }
}
