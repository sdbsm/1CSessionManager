using Microsoft.EntityFrameworkCore;
using SessionManager.Shared.Configuration;

namespace SessionManager.Shared.Data;

/// <summary>
/// DbContext factory that builds connection string dynamically (SQL login password comes from Windows Credential Manager).
/// </summary>
public sealed class DynamicDbContextFactory(SqlLoginConnectionStringProvider csProvider) : IDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext()
    {
        var cs = csProvider.BuildOrThrow();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(cs, sql => sql.MigrationsAssembly("1CSessionManager.Control"))
            .Options;
        return new AppDbContext(options);
    }
}


