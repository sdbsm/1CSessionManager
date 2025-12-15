using SessionManager.Control.Api.Http;
using SessionManager.Control.Api.Security;
using SessionManager.Control.Application.Admin;

namespace SessionManager.Control.Api.Endpoints;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin");

        group.MapGet("/apikey/status", async (IAdminConfigService admin, CancellationToken ct) =>
            Results.Ok(await admin.GetApiKeyStatusAsync(ct)));

        group.MapPost("/apikey", async (
            HttpContext http,
            ApiKeySetRequest req,
            IAdminConfigService admin,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.ApiKey) || req.ApiKey.Length < 16)
                return Results.BadRequest(new { error = "ApiKey must be at least 16 chars." });

            var currentKey = await admin.GetApiKeyPlainAsync(ct);

            // If already set, require old key.
            if (!string.IsNullOrWhiteSpace(currentKey))
            {
                if (!http.Request.Headers.TryGetValue("X-Api-Key", out var provided) || provided.Count == 0)
                    return Results.Unauthorized();

                var providedKey = provided[0];
                if (!ApiKeyComparer.FixedTimeEquals(providedKey, currentKey))
                    return Results.Unauthorized();
            }
            else
            {
                // bootstrap: allow only from localhost
                if (!RequestOrigin.IsLocalhost(http))
                    return Results.Unauthorized();
            }

            await admin.SetApiKeyAsync(req.ApiKey, ct);

            return Results.Ok(new { success = true });
        });

        // Admin: licenses total (how many 1C licenses are activated on the server).
        // Stored in DB as protected AppSecret (not sensitive, but keeps config centralized).
        group.MapGet("/licenses/status", async (IAdminConfigService admin, CancellationToken ct) =>
            Results.Ok(await admin.GetLicensesStatusAsync(ct)));

        group.MapPost("/licenses", async (LicensesSetRequest req, IAdminConfigService admin, CancellationToken ct) =>
        {
            if (req.Total < 0) return Results.BadRequest(new { error = "Total must be >= 0" });

            await admin.SetLicensesTotalAsync(req.Total, ct);
            return Results.Ok(new { success = true });
        });

        return endpoints;
    }
}
