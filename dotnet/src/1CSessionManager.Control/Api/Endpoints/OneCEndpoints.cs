using SessionManager.Control.Application.OneC;

namespace SessionManager.Control.Api.Endpoints;

public static class OneCEndpoints
{
    public static IEndpointRouteBuilder MapOneCEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Settings endpoint (maps to default agent settings) - legacy UI compatibility
        endpoints.MapGet("/api/settings", async (IOneCService oneC, CancellationToken ct) =>
        {
            var dto = await oneC.GetLegacySettingsAsync(ct);
            return dto is null ? Results.Ok(new { }) : Results.Ok(dto);
        });

        endpoints.MapPost("/api/settings", async (LegacySettingsUpdateRequest req, IOneCService oneC, CancellationToken ct) =>
        {
            try
            {
                var dto = await oneC.UpdateLegacySettingsAsync(req, ct);
                return Results.Ok(dto);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // Test-connection endpoint
        endpoints.MapPost("/api/test-connection", async (TestConnectionRequest req, IOneCService oneC, CancellationToken ct) =>
        {
            var res = await oneC.TestConnectionAsync(req, ct);
            return Results.Ok(res);
        });

        // Server info endpoint
        endpoints.MapGet("/api/server/info", (IOneCService oneC) =>
        {
            return Results.Ok(oneC.GetServerInfo());
        });

        // Infobases endpoint
        endpoints.MapGet("/api/infobases", async (IOneCService oneC, CancellationToken ct) =>
        {
            var items = await oneC.GetInfobasesAsync(ct);
            return Results.Ok(items);
        });

        return endpoints;
    }
}
