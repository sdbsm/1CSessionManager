using Serilog.Context;

namespace SessionManager.Control.Api.Middleware;

public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Correlation-Id";

    public async Task Invoke(HttpContext ctx)
    {
        var corrId = (string?)ctx.Request.Headers[HeaderName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(corrId))
            corrId = Guid.NewGuid().ToString("N");

        ctx.Response.Headers[HeaderName] = corrId;

        using (LogContext.PushProperty("CorrelationId", corrId))
        using (LogContext.PushProperty("TraceId", ctx.TraceIdentifier))
        {
            await next(ctx);
        }
    }
}

public static class CorrelationIdMiddlewareExtensions
{
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
        => app.UseMiddleware<CorrelationIdMiddleware>();
}
