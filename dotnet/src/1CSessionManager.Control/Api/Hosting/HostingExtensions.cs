using System.Text;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Hosting.WindowsServices;
using Serilog;

namespace SessionManager.Control.Api.Hosting;

public static class HostingExtensions
{
    public static WebApplicationBuilder AddControlHosting(this WebApplicationBuilder builder)
    {
        // Enable CP866 decoding for RAC output on Windows
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        // Add Windows Service support (safe to call even when running as console)
        builder.Services.AddWindowsService(options =>
        {
            options.ServiceName = "1C Session Manager Control";
        });

        builder.Host.UseSerilog((ctx, lc) =>
        {
            lc.ReadFrom.Configuration(ctx.Configuration);

            // Always keep these enrichers even if no Serilog section exists.
            lc.Enrich.FromLogContext();
            lc.Enrich.WithProperty("Service", "Control");
            lc.Enrich.WithProperty("Environment", ctx.HostingEnvironment.EnvironmentName);

            lc.WriteTo.Console();
            var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs", "control-.log");
            lc.WriteTo.File(logPath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14);
        });

        // Forwarded headers (reverse proxy / IIS / nginx). Disabled by default; enable via config:
        // Networking:UseForwardedHeaders=true
        // Networking:ForwardedHeaders:KnownProxies=["10.0.0.10"] or KnownNetworks=["10.0.0.0/8"]
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;

            var cfg = builder.Configuration;

            foreach (var ipStr in cfg.GetSection("Networking:ForwardedHeaders:KnownProxies").Get<string[]>() ?? Array.Empty<string>())
            {
                if (System.Net.IPAddress.TryParse(ipStr, out var ip))
                    options.KnownProxies.Add(ip);
            }

            foreach (var netStr in cfg.GetSection("Networking:ForwardedHeaders:KnownNetworks").Get<string[]>() ?? Array.Empty<string>())
            {
                // CIDR, e.g. 10.0.0.0/8
                var parts = netStr.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (parts.Length != 2) continue;
                if (!System.Net.IPAddress.TryParse(parts[0], out var ip)) continue;
                if (!int.TryParse(parts[1], out var prefix)) continue;
                try { options.KnownIPNetworks.Add(new System.Net.IPNetwork(ip, prefix)); } catch { /* ignore */ }
            }
        });

        return builder;
    }
}
