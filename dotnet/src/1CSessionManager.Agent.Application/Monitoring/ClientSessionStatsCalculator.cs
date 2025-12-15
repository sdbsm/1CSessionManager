using SessionManager.Shared.Data.Entities;

namespace SessionManager.Agent.Monitoring;

public static class ClientSessionStatsCalculator
{
    public sealed class ClientStats
    {
        public int TotalSessions { get; set; }
        public Dictionary<string, int> DbCounts { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public static Dictionary<Guid, ClientStats> ComputeClientStats(List<Client> clients, List<RacSession> sessions)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in clients)
        foreach (var db in c.Databases)
            map[db.Name] = c.Id;

        var stats = clients.ToDictionary(c => c.Id, _ => new ClientStats());

        foreach (var s in sessions)
        {
            if (s.DatabaseName is null) continue;
            if (!map.TryGetValue(s.DatabaseName, out var clientId)) continue;

            var st = stats[clientId];
            st.TotalSessions++;
            st.DbCounts[s.DatabaseName] = st.DbCounts.GetValueOrDefault(s.DatabaseName) + 1;
        }

        return stats;
    }
}
