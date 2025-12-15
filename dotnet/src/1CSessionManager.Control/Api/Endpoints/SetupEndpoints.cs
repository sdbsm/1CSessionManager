using SessionManager.Control.Api.Http;
using SessionManager.Control.Application.Setup;

namespace SessionManager.Control.Api.Endpoints;

public static class SetupEndpoints
{
    public static IEndpointRouteBuilder MapSetupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/setup");

        // DB endpoint settings (Server/Database/etc)
        group.MapGet("/db/status", (ISetupService setup) => Results.Ok(setup.GetDbEndpointStatus()));

        group.MapPost("/db", (SqlDbEndpointSetRequest req, ISetupService setup, HttpContext http) =>
        {
            // bootstrap: allow only from localhost
            if (!RequestOrigin.IsLocalhost(http))
                return Results.Unauthorized();

            try
            {
                setup.SetDbEndpoint(req);
                return Results.Ok(new { success = true });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // SQL login credentials
        group.MapGet("/sql/status", (ISetupService setup) => Results.Ok(setup.GetSqlLoginStatus()));

        group.MapPost("/sql", (SqlSetupRequest req, ISetupService setup, HttpContext http) =>
        {
            // bootstrap: allow only from localhost
            if (!RequestOrigin.IsLocalhost(http))
                return Results.Unauthorized();

            try
            {
                setup.SetSqlLogin(req);
                return Results.Ok(new { success = true });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // MSSQL connectivity test (SQL login stored in Windows Credential Manager).
        // Works even before DB is configured; allow only from localhost.
        group.MapPost("/sql/test", async (ISetupService setup, HttpContext http, CancellationToken ct) =>
        {
            if (!RequestOrigin.IsLocalhost(http))
                return Results.Unauthorized();

            var res = await setup.TestSqlAsync(ct);
            return Results.Ok(res);
        });

        return endpoints;
    }
}
