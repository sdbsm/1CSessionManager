using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using SessionManager.Control.Application.Dashboard;
using SessionManager.Control.Infrastructure.Agents;
using SessionManager.Shared.Configuration;
using SessionManager.Shared.Data;
using SessionManager.Shared.OneC.Rac;
using SessionManager.Shared.Security;

namespace SessionManager.Control.Infrastructure.Dashboard;

public sealed class DashboardService(
    IDbContextFactory<AppDbContext> dbFactory,
    SqlLoginConnectionStringProvider sqlProvider,
    SecretProtector protector,
    RacClient rac,
    IWebHostEnvironment env) : IDashboardService
{
    public async Task<DashboardStatsDto> GetStatsAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null)
        {
            return new DashboardStatsDto(
                DatabaseStats: new Dictionary<string, DatabaseStatsDto>(),
                TotalDatabases: 0,
                ConnectionTypes: new Dictionary<string, int>(),
                ClusterStatus: "unknown",
                ServerMetrics: new ServerMetricsDto(0, new MemoryMetricsDto(0, 0, 0), Disks: null),
                LastUpdate: null,
                Debug: null);
        }

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var agent = await db.Agents.AsNoTracking().FirstAsync(a => a.Id == agentId.Value, ct);

        string? pass = null;
        if (!string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
        {
            try { pass = protector.UnprotectFromBase64(agent.ClusterPassProtected); } catch { pass = null; }
        }

        var connectionTypes = new Dictionary<string, int> { ["1CV8"] = 0, ["1CV8C"] = 0, ["WebClient"] = 0, ["App"] = 0 };
        var databaseStats = new Dictionary<string, DatabaseStatsDto>(StringComparer.OrdinalIgnoreCase);

        string clusterStatus;
        string? debugError = null;

        var debugInfo = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["racPath"] = agent.RacPath,
            ["racExists"] = File.Exists(agent.RacPath.Trim().Trim('\"')),
            ["rasHost"] = agent.RasHost,
            ["clusterUserSet"] = !string.IsNullOrWhiteSpace(agent.ClusterUser),
            ["clusterPassSet"] = !string.IsNullOrWhiteSpace(agent.ClusterPassProtected)
        };

        try
        {
            var clusterListOut = await RunRacAsync(rac, agent.RacPath, agent.RasHost, ["cluster", "list"], agent.ClusterUser, pass, ct);
            var clusters = RacOutputParser.ParseBlocks(clusterListOut);
            var clusterId = clusters.FirstOrDefault()?.GetValueOrDefault("cluster");

            if (string.IsNullOrWhiteSpace(clusterId))
            {
                clusterStatus = "offline";
            }
            else
            {
                clusterStatus = "online";

                var uuidToName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var allDbNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                var infobaseOut = await RunRacAsync(rac, agent.RacPath, agent.RasHost, ["infobase", "summary", "list", $"--cluster={clusterId}"], agent.ClusterUser, pass, ct);
                var infobases = RacOutputParser.ParseBlocks(infobaseOut);

                foreach (var item in infobases)
                {
                    var uid = item.GetValueOrDefault("infobase") ?? item.GetValueOrDefault("uuid") ?? item.GetValueOrDefault("infobase_id");
                    var name = item.GetValueOrDefault("name");
                    if (!string.IsNullOrWhiteSpace(uid) && !string.IsNullOrWhiteSpace(name))
                    {
                        uuidToName[uid] = name;
                        allDbNames.Add(name);
                    }
                }

                var sessOut = await RunRacAsync(rac, agent.RacPath, agent.RasHost, ["session", "list", $"--cluster={clusterId}"], agent.ClusterUser, pass, ct);
                var sessions = RacOutputParser.ParseBlocks(sessOut);
                var dbCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                foreach (var s in sessions)
                {
                    var appId = s.GetValueOrDefault("app_id") ?? "";
                    if (connectionTypes.ContainsKey(appId))
                        connectionTypes[appId]++;

                    var infobaseUuid = s.GetValueOrDefault("infobase") ?? s.GetValueOrDefault("infobase_id");
                    if (string.IsNullOrWhiteSpace(infobaseUuid)) continue;
                    if (!uuidToName.TryGetValue(infobaseUuid, out var dbName)) continue;

                    dbCounts[dbName] = dbCounts.GetValueOrDefault(dbName) + 1;
                }

                var dbSizes = await TryReadDbSizesAsync(ct);

                foreach (var dbName in allDbNames)
                {
                    decimal? sizeMB = null;
                    if (dbSizes is not null && dbSizes.TryGetValue(dbName, out var mb)) sizeMB = mb;
                    databaseStats[dbName] = new DatabaseStatsDto(Sessions: dbCounts.GetValueOrDefault(dbName), SizeMB: sizeMB);
                }
            }
        }
        catch (Exception ex)
        {
            clusterStatus = "unknown";
            debugError = ex.Message;
        }

        var lastMetric = await db.AgentMetricBuckets
            .AsNoTracking()
            .Where(x => x.AgentId == agentId.Value)
            .OrderByDescending(x => x.BucketStartUtc)
            .FirstOrDefaultAsync(ct);

        int cpu = lastMetric?.CpuPercent ?? 0;
        int memUsed = lastMetric?.MemoryUsedMb ?? 0;
        int memTotal = lastMetric?.MemoryTotalMb ?? 0;
        int memPercent = memTotal > 0 ? (int)Math.Round((double)memUsed / memTotal * 100) : 0;

        JsonElement? disks = null;
        if (!string.IsNullOrWhiteSpace(lastMetric?.DiskSpaceJson))
        {
            try { disks = JsonSerializer.Deserialize<JsonElement>(lastMetric!.DiskSpaceJson!); } catch { disks = null; }
        }

        DashboardDebugDto? debug = null;
        if (env.IsDevelopment())
            debug = new DashboardDebugDto(Error: debugError, Info: debugInfo);

        return new DashboardStatsDto(
            DatabaseStats: databaseStats,
            TotalDatabases: databaseStats.Count,
            ConnectionTypes: connectionTypes,
            ClusterStatus: clusterStatus,
            ServerMetrics: new ServerMetricsDto(cpu, new MemoryMetricsDto(memUsed, memTotal, memPercent), disks),
            LastUpdate: DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            Debug: debug);
    }

    private async Task<Dictionary<string, decimal>?> TryReadDbSizesAsync(CancellationToken ct)
    {
        try
        {
            if (!sqlProvider.IsConfigured)
                return null;

            var cs = sqlProvider.BuildOrThrow();
            await using var sqlConn = new Microsoft.Data.SqlClient.SqlConnection(cs);
            await sqlConn.OpenAsync(ct);

            await using var cmd = sqlConn.CreateCommand();
            cmd.CommandText = "SELECT DB_NAME(database_id) as Name, CAST(SUM(size) * 8. / 1024 AS DECIMAL(10,2)) as SizeMB FROM sys.master_files GROUP BY database_id";

            var sizes = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var name = reader.IsDBNull(0) ? "" : reader.GetString(0);
                var size = reader.IsDBNull(1) ? 0 : reader.GetDecimal(1);
                if (!string.IsNullOrWhiteSpace(name))
                    sizes[name] = size;
            }

            return sizes;
        }
        catch
        {
            return null;
        }
    }

    private static async Task<string?> RunRacAsync(
        RacClient rac,
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
}
