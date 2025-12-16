using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Infrastructure.Agents;
using SessionManager.Control.Services;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Security;

namespace SessionManager.Control.Api.Endpoints;

public static class AgentsEndpoints
{
    public static IEndpointRouteBuilder MapAgentsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Agent settings (passwords are never returned)
        endpoints.MapGet("/api/agent/settings", async (Guid agentId, IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync(ct);
            var agent = await db.Agents
                .Include(a => a.Publications)
                .FirstOrDefaultAsync(a => a.Id == agentId, ct);
            if (agent is null) return Results.NotFound();

            return Results.Ok(new AgentSettingsResponse(
                AgentId: agent.Id,
                Enabled: agent.Enabled,
                RacPath: agent.RacPath,
                RasHost: agent.RasHost,
                ClusterUser: agent.ClusterUser,
                ClusterPassIsSet: !string.IsNullOrWhiteSpace(agent.ClusterPassProtected),
                KillModeEnabled: agent.KillModeEnabled,
                PollIntervalSeconds: agent.PollIntervalSeconds,
                DefaultOneCVersion: agent.DefaultOneCVersion,
                InstalledVersionsJson: agent.InstalledVersionsJson,
                Publications: agent.Publications.OrderBy(p => p.SiteName).ThenBy(p => p.AppPath)
                    .Select(p => new AgentPublicationDto(
                        p.Id, p.SiteName, p.AppPath, p.PhysicalPath, p.Version, p.LastDetectedAtUtc))
                    .ToList()
            ));
        });

        endpoints.MapPost("/api/agent/settings", async (
            Guid agentId,
            AgentSettingsUpdateRequest req,
            IDbContextFactory<AppDbContext> dbFactory,
            SecretProtector protector,
            CancellationToken ct) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync(ct);
            var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, ct);
            if (agent is null) return Results.NotFound();

            if (req.Enabled is not null) agent.Enabled = req.Enabled.Value;
            if (!string.IsNullOrWhiteSpace(req.RacPath)) agent.RacPath = req.RacPath.Trim();
            if (!string.IsNullOrWhiteSpace(req.RasHost)) agent.RasHost = req.RasHost.Trim();
            if (req.ClusterUser is not null) agent.ClusterUser = req.ClusterUser.Trim();
            if (req.KillModeEnabled is not null) agent.KillModeEnabled = req.KillModeEnabled.Value;
            if (req.PollIntervalSeconds is not null) agent.PollIntervalSeconds = Math.Clamp(req.PollIntervalSeconds.Value, 5, 3600);
            if (req.DefaultOneCVersion is not null) agent.DefaultOneCVersion = req.DefaultOneCVersion;

            // Password rule:
            // - null => don't change
            // - empty string => keep as-is (we don't support "clear" yet)
            // - non-empty => overwrite with protected value
            if (req.ClusterPass is not null && !string.IsNullOrWhiteSpace(req.ClusterPass))
            {
                agent.ClusterPassProtected = protector.ProtectToBase64(req.ClusterPass);
            }

            await db.SaveChangesAsync(ct);

            return Results.Ok(new { success = true });
        });

        // Agents list (for UI later)
        endpoints.MapGet("/api/agents", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync(ct);
            var agents = await db.Agents
                .OrderBy(a => a.Name)
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.Hostname,
                    a.LastSeenAtUtc,
                    a.Enabled,
                    a.LastKnownClusterStatus
                })
                .ToListAsync(ct);

            return Results.Ok(agents);
        });

        // Send commands
        endpoints.MapPost("/api/agents/{agentId}/commands", async (
            Guid agentId,
            AgentCommandRequest req,
            IDbContextFactory<AppDbContext> dbFactory,
            CancellationToken ct) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync(ct);
            
            var cmd = new AgentCommand
            {
                AgentId = agentId,
                CommandType = req.Type,
                PayloadJson = req.PayloadJson,
                Status = "Pending",
                CreatedAtUtc = DateTime.UtcNow
            };
            
            db.AgentCommands.Add(cmd);
            await db.SaveChangesAsync(ct);
            
            return Results.Ok(new { commandId = cmd.Id });
        });
        
        // Recent agent commands (status/progress surface for UI)
        endpoints.MapGet("/api/agents/{agentId}/commands", async (
            Guid agentId,
            int? take,
            IDbContextFactory<AppDbContext> dbFactory,
            CancellationToken ct) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync(ct);

            var n = Math.Clamp(take ?? 20, 1, 200);

            var rows = await db.AgentCommands
                .AsNoTracking()
                .Where(x => x.AgentId == agentId)
                .OrderByDescending(x => x.CreatedAtUtc)
                .Take(n)
                .Select(x => new AgentCommandDto(
                    x.Id,
                    x.CommandType,
                    x.Status,
                    x.ErrorMessage,
                    x.ProgressPercent,
                    x.ProgressMessage,
                    x.StartedAtUtc,
                    x.LastUpdatedAtUtc,
                    x.CreatedAtUtc,
                    x.ProcessedAtUtc
                ))
                .ToListAsync(ct);

            return Results.Ok(rows);
        });

        // Delete old completed/failed commands
        endpoints.MapDelete("/api/agents/{agentId}/commands/old", async (
            Guid agentId,
            int? daysOld,
            IDbContextFactory<AppDbContext> dbFactory,
            CancellationToken ct) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync(ct);

            // Default: delete commands older than 7 days that are completed or failed
            var cutoffDate = DateTime.UtcNow.AddDays(-(daysOld ?? 7));
            
            var oldCommands = await db.AgentCommands
                .Where(x => x.AgentId == agentId 
                    && (x.Status == "Completed" || x.Status == "Failed")
                    && x.ProcessedAtUtc.HasValue
                    && x.ProcessedAtUtc.Value < cutoffDate)
                .ToListAsync(ct);

            var count = oldCommands.Count;
            if (count > 0)
            {
                db.AgentCommands.RemoveRange(oldCommands);
                await db.SaveChangesAsync(ct);
            }

            return Results.Ok(new { deletedCount = count, cutoffDate });
        });

        // Default-agent fallback for UI requests that don't specify agentId (backward compatible)
        endpoints.MapGet("/api/_internal/default-agent", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
        {
            var id = await GetDefaultAgentIdAsync(dbFactory, ct);
            return Results.Ok(new { agentId = id });
        });

        return endpoints;
    }

    public static async Task<Guid?> GetDefaultAgentIdAsync(IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct)
        => await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);

    internal sealed record AgentSettingsResponse(
        Guid AgentId,
        bool Enabled,
        string RacPath,
        string RasHost,
        string? ClusterUser,
        bool ClusterPassIsSet,
        bool KillModeEnabled,
        int PollIntervalSeconds,
        string? DefaultOneCVersion,
        string? InstalledVersionsJson,
        List<AgentPublicationDto> Publications);

    internal sealed record AgentSettingsUpdateRequest(
        bool? Enabled,
        string? RacPath,
        string? RasHost,
        string? ClusterUser,
        string? ClusterPass,
        bool? KillModeEnabled,
        int? PollIntervalSeconds,
        string? DefaultOneCVersion);
        
    internal sealed record AgentCommandRequest(string Type, string? PayloadJson);

    internal sealed record AgentCommandDto(
        Guid Id,
        string CommandType,
        string Status,
        string? ErrorMessage,
        int? ProgressPercent,
        string? ProgressMessage,
        DateTime? StartedAtUtc,
        DateTime? LastUpdatedAtUtc,
        DateTime CreatedAtUtc,
        DateTime? ProcessedAtUtc);
        
    internal sealed record AgentPublicationDto(
        Guid Id,
        string SiteName,
        string AppPath,
        string PhysicalPath,
        string? Version,
        DateTime LastDetectedAtUtc);
}
