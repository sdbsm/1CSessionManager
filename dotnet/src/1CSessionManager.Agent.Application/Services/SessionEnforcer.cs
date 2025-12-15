using SessionManager.Agent.Monitoring;
using SessionManager.Agent.Ports;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Agent.Services;

public sealed class SessionEnforcer(IRacSessionClient rac, IAgentDataStore store)
{
    public async Task EnforceAsync(
        AgentInstance agent,
        string clusterId,
        List<Client> clients,
        List<RacSession> sessions,
        Dictionary<Guid, ClientSessionStatsCalculator.ClientStats> stats,
        CancellationToken ct)
    {
        var dbToClient = new Dictionary<string, Client>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in clients)
        foreach (var db in c.Databases)
            dbToClient[db.Name] = c;

        var sessionsByClient = new Dictionary<Guid, List<RacSession>>();
        foreach (var s in sessions)
        {
            if (s.DatabaseName is null) continue;
            if (!dbToClient.TryGetValue(s.DatabaseName, out var client)) continue;

            if (!sessionsByClient.TryGetValue(client.Id, out var list))
            {
                list = new List<RacSession>();
                sessionsByClient[client.Id] = list;
            }
            list.Add(s);
        }

        foreach (var client in clients)
        {
            if (!sessionsByClient.TryGetValue(client.Id, out var list) || list.Count == 0)
                continue;

            if (client.Status == ClientStatus.Blocked)
            {
                await KillSessionsAsync(agent, clusterId, client, list, reason: "Доступ заблокирован администратором.", ct);
                continue;
            }

            var active = stats.GetValueOrDefault(client.Id)?.TotalSessions ?? 0;
            if (client.MaxSessions > 0 && active > client.MaxSessions)
            {
                var excess = active - client.MaxSessions;
                var toKill = list
                    .OrderByDescending(s => s.StartedAtUtc)
                    .Take(excess)
                    .ToList();

                await KillSessionsAsync(agent, clusterId, client, toKill, reason: "Лимит сеансов превышен. Обратитесь к администратору.", ct);
            }
        }
    }

    private async Task KillSessionsAsync(
        AgentInstance agent,
        string clusterId,
        Client client,
        List<RacSession> toKill,
        string reason,
        CancellationToken ct)
    {
        foreach (var s in toKill)
        {
            var ok = await rac.TerminateSessionAsync(agent, clusterId, s.Id, reason, ct);

            try
            {
                await store.WriteEventAsync(
                    agent.Id,
                    ok ? EventLevel.Info : EventLevel.Warning,
                    ok
                        ? $"Сеанс завершен. Клиент: {client.Name}, База: {s.DatabaseName ?? "?"}, Пользователь: {s.UserName ?? "?"}"
                        : $"Не удалось завершить сеанс. Клиент: {client.Name}, SessionId: {s.Id}",
                    ct);
            }
            catch
            {
                // ignore
            }
        }
    }
}

