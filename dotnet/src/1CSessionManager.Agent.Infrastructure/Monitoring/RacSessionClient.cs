using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.OneC.Rac;
using SessionManager.Shared.Security;
using SessionManager.Agent.Ports;

namespace SessionManager.Agent.Monitoring;

public sealed class RacSessionClient : IRacSessionClient
{
    private readonly RacClient _rac;
    private readonly SecretProtector _protector;

    public RacSessionClient(RacClient rac, SecretProtector protector)
    {
        _rac = rac;
        _protector = protector;
    }

    public async Task<string?> GetClusterIdAsync(AgentInstance agent, CancellationToken ct)
    {
        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, ["cluster", "list"], ct);
        var list = RacOutputParser.ParseBlocks(outStr);
        if (list.Count == 0)
            return null;

        if (list[0].TryGetValue("cluster", out var clusterId) && !string.IsNullOrWhiteSpace(clusterId))
            return clusterId;

        return null;
    }

    public async Task<Dictionary<string, string>> GetInfobaseMapAsync(AgentInstance agent, string clusterId, CancellationToken ct)
    {
        var args = new List<string> { "infobase", "summary", "list", $"--cluster={clusterId}" };
        args.AddRange(BuildAuthArgs(agent));

        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, args, ct);
        var list = RacOutputParser.ParseBlocks(outStr);

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in list)
        {
            var uid = item.GetValueOrDefault("infobase")
                      ?? item.GetValueOrDefault("uuid")
                      ?? item.GetValueOrDefault("infobase_id");
            var name = item.GetValueOrDefault("name");
            if (!string.IsNullOrWhiteSpace(uid) && !string.IsNullOrWhiteSpace(name))
                map[uid] = name;
        }
        return map;
    }

    public async Task<List<RacSession>> GetSessionsAsync(
        AgentInstance agent,
        string clusterId,
        IReadOnlyDictionary<string, string> infobaseMap,
        CancellationToken ct)
    {
        var args = new List<string> { "session", "list", $"--cluster={clusterId}" };
        args.AddRange(BuildAuthArgs(agent));

        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, args, ct);
        var list = RacOutputParser.ParseBlocks(outStr);

        var sessions = new List<RacSession>(list.Count);
        foreach (var item in list)
        {
            var sessionId = item.GetValueOrDefault("session") ?? item.GetValueOrDefault("session_id");
            if (string.IsNullOrWhiteSpace(sessionId))
                continue;

            var appId = item.GetValueOrDefault("app_id") ?? "";
            if (appId is not ("1CV8" or "1CV8C" or "WebClient" or "App"))
                continue;

            var infobaseUuid = item.GetValueOrDefault("infobase") ?? item.GetValueOrDefault("infobase_id");
            var dbName = (infobaseUuid is not null && infobaseMap.TryGetValue(infobaseUuid, out var name))
                ? name
                : null;

            var startedAt = RacOutputParser.TryParseRacDateUtc(item.GetValueOrDefault("started_at")) ?? DateTime.UtcNow;
            var userName = item.GetValueOrDefault("user_name");

            sessions.Add(new RacSession(
                Id: sessionId,
                StartedAtUtc: startedAt,
                AppId: appId,
                InfobaseUuid: infobaseUuid,
                DatabaseName: dbName,
                UserName: userName));
        }

        return sessions;
    }

    public async Task<bool> TerminateSessionAsync(
        AgentInstance agent,
        string clusterId,
        string sessionId,
        string? reason,
        CancellationToken ct)
    {
        var args = new List<string>
        {
            "session", "terminate",
            $"--cluster={clusterId}",
            $"--session={sessionId}"
        };

        if (!string.IsNullOrWhiteSpace(reason))
            args.Add($"--error-message={reason.Replace('"', '\'')}");

        args.AddRange(BuildAuthArgs(agent));

        var outStr = await _rac.RunAsync(agent.RacPath, agent.RasHost, args, ct);
        return outStr is not null;
    }

    private IReadOnlyList<string> BuildAuthArgs(AgentInstance agent)
    {
        if (string.IsNullOrWhiteSpace(agent.ClusterUser))
            return Array.Empty<string>();

        var pwd = "";
        if (!string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
        {
            try
            {
                pwd = _protector.UnprotectFromBase64(agent.ClusterPassProtected);
            }
            catch
            {
                // If value is not protected (misconfiguration), fall back to raw (but this should not happen in production)
                pwd = agent.ClusterPassProtected;
            }
        }

        return
        [
            $"--cluster-user={agent.ClusterUser}",
            $"--cluster-pwd={pwd}"
        ];
    }
}
