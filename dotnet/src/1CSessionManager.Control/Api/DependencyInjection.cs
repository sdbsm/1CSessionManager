using SessionManager.Control.Services;
using SessionManager.Control.Application.Admin;
using SessionManager.Control.Application.Clients;
using SessionManager.Control.Application.Dashboard;
using SessionManager.Control.Application.Events;
using SessionManager.Control.Application.Metrics;
using SessionManager.Control.Application.OneC;
using SessionManager.Control.Application.Setup;
using SessionManager.Control.Infrastructure.Admin;
using SessionManager.Control.Infrastructure.Clients;
using SessionManager.Control.Infrastructure.Dashboard;
using SessionManager.Control.Infrastructure.Events;
using SessionManager.Control.Infrastructure.Metrics;
using SessionManager.Control.Infrastructure.OneC;
using SessionManager.Control.Infrastructure.Setup;
using SessionManager.Shared.Security;
using SessionManager.Shared.OneC.Rac;
using SessionManager.Shared.Configuration;

namespace SessionManager.Control.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddControlServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOpenApi();
        services.AddProblemDetails();
        services.AddMemoryCache();

        services.AddSingleton<SecretProtector>();
        services.AddSingleton<AppSecretService>();

        services.AddSqlServerAppDb(configuration);

        services.AddSingleton(_ => new RacClient(timeout: TimeSpan.FromSeconds(30)));

        services.AddSingleton<IDashboardService, DashboardService>();
        services.AddSingleton<IDashboardInsightsService, DashboardInsightsService>();
        services.AddSingleton<IEventsService, EventsService>();
        services.AddSingleton<IOneCService, OneCService>();
        services.AddSingleton<IClientsService, ClientsService>();
        services.AddSingleton<ISetupService, SetupService>();
        services.AddSingleton<IAdminConfigService, AdminConfigService>();
        services.AddSingleton<IMetricsService, MetricsService>();

        services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
        {
            options.SerializerOptions.PropertyNameCaseInsensitive = true;
        });

        return services;
    }
}
