using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SessionManager.Shared.Data;
using SessionManager.Shared.Security;

namespace SessionManager.Shared.Configuration;

public static class DependencyInjection
{
    /// <summary>
    /// Registers SQL Server connectivity for <see cref="AppDbContext"/>.
    /// Connection string is built dynamically: endpoint settings come from appsettings or Windows Credential Manager;
    /// SQL login credentials are stored in Windows Credential Manager.
    /// </summary>
    public static IServiceCollection AddSqlServerAppDb(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SqlLoginConnectionOptions>(configuration.GetSection("Database:Sql"));

        services.AddSingleton<WindowsCredentialStore>();
        services.AddSingleton<SqlDbEndpointSecretStore>();
        services.AddSingleton<SqlLoginSecretStore>();
        services.AddSingleton<SqlLoginConnectionStringProvider>();

        // NOTE: migrations live in 1CSessionManager.Control
        services.AddSingleton<IDbContextFactory<AppDbContext>, DynamicDbContextFactory>();

        return services;
    }
}
