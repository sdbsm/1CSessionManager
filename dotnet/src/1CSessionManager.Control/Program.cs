using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using Serilog;
using Serilog.Events;
using SessionManager.Control.Api;
using SessionManager.Control.Api.Endpoints;
using SessionManager.Control.Api.Hosting;
using SessionManager.Control.Api.Middleware;
using SessionManager.Shared.Data;

var builder = WebApplication.CreateBuilder(args);

builder.AddControlHosting();
builder.Services.AddControlServices(builder.Configuration);

var app = builder.Build();

// IMPORTANT: should run before anything that reads RemoteIpAddress (auth/setup bootstrap rules).
if (builder.Configuration.GetValue<bool>("Networking:UseForwardedHeaders"))
{
    app.UseForwardedHeaders();
}

app.UseCorrelationId();
app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (httpContext, elapsed, ex) =>
    {
        if (ex is not null) return LogEventLevel.Error;
        var status = httpContext.Response.StatusCode;
        return status >= 500 ? LogEventLevel.Error
            : status >= 400 ? LogEventLevel.Warning
            : LogEventLevel.Information;
    };

    options.EnrichDiagnosticContext = (diag, httpContext) =>
    {
        diag.Set("RemoteIp", httpContext.Connection.RemoteIpAddress?.ToString() ?? "");
        diag.Set("RequestHost", httpContext.Request.Host.Value ?? "");
        diag.Set("RequestScheme", httpContext.Request.Scheme ?? "");
        diag.Set("RequestPath", httpContext.Request.Path.Value ?? "");
        diag.Set("RequestQuery", httpContext.Request.QueryString.Value ?? "");
        diag.Set("UserAgent", httpContext.Request.Headers.UserAgent.ToString() ?? "");
    };
});
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Serve React UI from wwwroot/app (built by Vite)
app.UseDefaultFiles();
app.UseStaticFiles();

// Redirect root to UI for best UX (keeps /settings.html accessible).
app.MapGet("/", () => Results.Redirect("/app/"));

// SPA fallback for React UI (served under /app/)
app.MapFallbackToFile("/app/{*path:nonfile}", "app/index.html");

// API protection (remote requires X-Api-Key; localhost is allowed)
app.UseApiKeyAuth();

// Optional auto-migrations (recommended for dev / first install).
if (builder.Configuration.GetValue<bool>("Database:AutoMigrate"))
{
    try
    {
        await using var db = await app.Services
            .GetRequiredService<IDbContextFactory<AppDbContext>>()
            .CreateDbContextAsync();

        await db.Database.MigrateAsync();
    }
    catch
    {
        // ignore if DB not configured yet
    }
}

app.MapHealthEndpoints();
app.MapSetupEndpoints();
app.MapAdminEndpoints();
app.MapAgentsEndpoints();
app.MapOneCEndpoints();
app.MapClientsEndpoints();
app.MapEventsEndpoints();
app.MapDashboardEndpoints();
app.MapMetricsEndpoints();

try
{
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Fatal startup error");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
