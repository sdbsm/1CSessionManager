using Microsoft.EntityFrameworkCore;
using SessionManager.Shared.Data;

namespace SessionManager.Control.Infrastructure.Agents;

public static class AgentResolver
{
    public static async Task<Guid?> GetDefaultAgentIdAsync(IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        return await db.Agents.OrderBy(a => a.CreatedAtUtc).Select(a => (Guid?)a.Id).FirstOrDefaultAsync(ct);
    }
}
