using Microsoft.Extensions.Caching.Memory;
using SessionManager.Control.Services;
using SessionManager.Control.Api.Http;
using SessionManager.Control.Api.Security;

namespace SessionManager.Control.Api.Middleware;

public sealed class ApiKeyAuthMiddleware(RequestDelegate next)
{
    public async Task Invoke(HttpContext ctx, IMemoryCache cache, AppSecretService secrets)
    {
        if (!ctx.Request.Path.StartsWithSegments("/api"))
        {
            await next(ctx);
            return;
        }

        // Always allow health
        if (ctx.Request.Path.StartsWithSegments("/api/health"))
        {
            await next(ctx);
            return;
        }

        // Allow localhost without API key (bootstrap/setup UX)
        if (RequestOrigin.IsLocalhost(ctx))
        {
            await next(ctx);
            return;
        }

        // Bootstrap endpoints intentionally manage their own auth rules
        if (ctx.Request.Path.StartsWithSegments("/api/setup") || ctx.Request.Path.StartsWithSegments("/api/admin/apikey"))
        {
            await next(ctx);
            return;
        }

        // Load key (cached) from DB; if DB is not ready => treat as not configured.
        string? apiKey;
        try
        {
            apiKey = await cache.GetOrCreateAsync("auth.apiKey", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
                return await secrets.GetPlainAsync(AppSecretService.ApiKeySecretKey, ctx.RequestAborted);
            });
        }
        catch
        {
            apiKey = null;
        }

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsync("API key is not configured. Configure it from localhost UI.");
            return;
        }

        if (!ctx.Request.Headers.TryGetValue("X-Api-Key", out var provided) || provided.Count == 0)
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsync("Unauthorized");
            return;
        }

        var providedKey = provided[0] ?? string.Empty;
        if (!ApiKeyComparer.FixedTimeEquals(providedKey, apiKey))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsync("Unauthorized");
            return;
        }

        await next(ctx);
    }
}

public static class ApiKeyAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseApiKeyAuth(this IApplicationBuilder app)
        => app.UseMiddleware<ApiKeyAuthMiddleware>();
}
