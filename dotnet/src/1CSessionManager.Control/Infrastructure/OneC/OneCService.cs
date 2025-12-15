using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Application.OneC;
using SessionManager.Control.Infrastructure.Agents;
using SessionManager.Shared.Data;
using SessionManager.Shared.OneC.Rac;
using SessionManager.Shared.Security;

namespace SessionManager.Control.Infrastructure.OneC;

public sealed class OneCService(
    IDbContextFactory<AppDbContext> dbFactory,
    SecretProtector protector,
    RacClient rac) : IOneCService
{
    public async Task<LegacySettingsDto?> GetLegacySettingsAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null) return null;

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId.Value, ct);
        if (agent is null) return null;

        return ToLegacySettingsDto(agent);
    }

    public async Task<LegacySettingsDto> UpdateLegacySettingsAsync(LegacySettingsUpdateRequest req, CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null)
            throw new InvalidOperationException("No agent registered yet. Start Agent first.");

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstAsync(a => a.Id == agentId.Value, ct);

        if (!string.IsNullOrWhiteSpace(req.RacPath)) agent.RacPath = req.RacPath.Trim();
        if (!string.IsNullOrWhiteSpace(req.RasHost)) agent.RasHost = req.RasHost.Trim();
        if (req.ClusterUser is not null) agent.ClusterUser = req.ClusterUser.Trim();
        if (req.CheckInterval is not null) agent.PollIntervalSeconds = Math.Clamp(req.CheckInterval.Value, 5, 3600);
        if (req.KillMode is not null) agent.KillModeEnabled = req.KillMode.Value;

        // Password semantics (legacy-compatible):
        // - null => keep
        // - "***ENCRYPTED***" => keep
        // - empty string => keep
        // - non-empty => overwrite (DPAPI-protected)
        if (req.ClusterPass is not null)
        {
            var cp = req.ClusterPass;
            if (!string.IsNullOrWhiteSpace(cp) && cp != OneCConstants.EncryptedPlaceholder)
                agent.ClusterPassProtected = protector.ProtectToBase64(cp);
        }

        await db.SaveChangesAsync(ct);
        return ToLegacySettingsDto(agent);
    }

    public async Task<TestConnectionResponse> TestConnectionAsync(TestConnectionRequest req, CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null)
            return new TestConnectionResponse(false, null, "Agent not registered yet. Start Agent first.");

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstAsync(a => a.Id == agentId.Value, ct);

        var racPath = !string.IsNullOrWhiteSpace(req.RacPath) ? req.RacPath.Trim() : agent.RacPath;
        var rasHost = !string.IsNullOrWhiteSpace(req.RasHost) ? req.RasHost.Trim() : agent.RasHost;
        var clusterUser = req.ClusterUser is not null ? req.ClusterUser.Trim() : agent.ClusterUser;

        string? clusterPassPlain = null;
        if (req.ClusterPass is not null)
        {
            var cp = req.ClusterPass;
            if (!string.IsNullOrWhiteSpace(cp) && cp != OneCConstants.EncryptedPlaceholder)
                clusterPassPlain = cp;
        }

        if (clusterPassPlain is null && !string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
        {
            try { clusterPassPlain = protector.UnprotectFromBase64(agent.ClusterPassProtected); } catch { /* ignore */ }
        }

        try
        {
            var output = await RunRacAsync(racPath, rasHost, ["cluster", "list"], clusterUser, clusterPassPlain, ct);
            if (output is null)
                return new TestConnectionResponse(false, null, "Соединение не установлено. Проверьте путь к rac.exe и адрес RAS.");

            return new TestConnectionResponse(true, output, null);
        }
        catch (Exception ex)
        {
            return new TestConnectionResponse(false, null, $"Ошибка: {ex.Message}");
        }
    }

    public ServerInfoDto GetServerInfo() => new(
        Hostname: Environment.MachineName,
        OsVersion: System.Runtime.InteropServices.RuntimeInformation.OSDescription);

    public async Task<IReadOnlyList<InfobaseDto>> GetInfobasesAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null) return Array.Empty<InfobaseDto>();

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.FirstAsync(a => a.Id == agentId.Value, ct);

        string? pass = null;
        if (!string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
        {
            try { pass = protector.UnprotectFromBase64(agent.ClusterPassProtected); } catch { pass = null; }
        }

        var clusterListOut = await RunRacAsync(agent.RacPath, agent.RasHost, ["cluster", "list"], agent.ClusterUser, pass, ct);
        var clusters = RacOutputParser.ParseBlocks(clusterListOut);
        var clusterId = clusters.FirstOrDefault()?.GetValueOrDefault("cluster");
        if (string.IsNullOrWhiteSpace(clusterId)) return Array.Empty<InfobaseDto>();

        var outStr = await RunRacAsync(agent.RacPath, agent.RasHost, ["infobase", "summary", "list", $"--cluster={clusterId}"], agent.ClusterUser, pass, ct);
        var list = RacOutputParser.ParseBlocks(outStr);

        return list
            .Select(item => new InfobaseDto(
                Name: item.GetValueOrDefault("name") ?? "",
                Uuid: item.GetValueOrDefault("infobase") ?? item.GetValueOrDefault("uuid") ?? item.GetValueOrDefault("infobase_id") ?? ""))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) && !string.IsNullOrWhiteSpace(x.Uuid))
            .ToArray();
    }

    private async Task<string?> RunRacAsync(
        string racPath,
        string rasHost,
        IReadOnlyList<string> args,
        string? clusterUser,
        string? clusterPass,
        CancellationToken ct)
    {
        var fullArgs = new List<string>(args);
        if (!string.IsNullOrWhiteSpace(clusterUser))
        {
            fullArgs.Add($"--cluster-user={clusterUser}");
            fullArgs.Add($"--cluster-pwd={clusterPass ?? ""}");
        }
        return await rac.RunAsync(racPath, rasHost, fullArgs, ct);
    }

    private static LegacySettingsDto ToLegacySettingsDto(SessionManager.Shared.Data.Entities.AgentInstance agent) => new(
        RacPath: agent.RacPath,
        RasHost: agent.RasHost,
        ClusterUser: agent.ClusterUser ?? "",
        ClusterPass: string.IsNullOrWhiteSpace(agent.ClusterPassProtected) ? "" : OneCConstants.EncryptedPlaceholder,
        CheckInterval: agent.PollIntervalSeconds,
        KillMode: agent.KillModeEnabled);
}
