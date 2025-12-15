using Microsoft.Extensions.Logging;
using SessionManager.Agent.Monitoring;
using SessionManager.Agent.Ports;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Agent.Services;

public sealed class AgentMonitorLoop(
    ILogger<AgentMonitorLoop> logger,
    IAgentIdentityProvider identity,
    IAgentDataStore store,
    IRacSessionClient rac,
    ISystemMetricsCollector systemMetrics,
    SessionEnforcer enforcer)
{
    private DateTime _lastRacNotFoundLogUtc = DateTime.MinValue;
    private DateTime _lastRacErrorLogUtc = DateTime.MinValue;

    public async Task RunAsync(CancellationToken stoppingToken)
    {
        var agentId = identity.GetOrCreateAgentId();
        logger.LogInformation("Agent starting. AgentId={AgentId}", agentId);

        // Best-effort startup registration
        try
        {
            await store.UpsertAgentAsync(agentId, stoppingToken);
            await store.WriteEventAsync(agentId, EventLevel.Info, "Agent started", stoppingToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize DB connection.");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await store.UpsertAgentAsync(agentId, stoppingToken);

                var sys = systemMetrics.Collect();

                var agent = await store.GetAgentAsync(agentId, stoppingToken);
                if (!agent.Enabled)
                {
                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                    continue;
                }

                var clients = await store.LoadClientsAsync(agentId, stoppingToken);

                try
                {
                    var clusterId = await rac.GetClusterIdAsync(agent, stoppingToken);
                    if (clusterId is null)
                    {
                        await store.UpdateClusterStatusAsync(agentId, ClusterStatus.Offline, stoppingToken);
                        await store.WriteMetricBucketSafeAsync(agentId, ClusterStatus.Offline, totalSessions: 0, clients, stoppingToken, sys: sys);
                        await Task.Delay(TimeSpan.FromSeconds(agent.PollIntervalSeconds), stoppingToken);
                        continue;
                    }

                    await store.UpdateClusterStatusAsync(agentId, ClusterStatus.Online, stoppingToken);

                    var dbMap = await rac.GetInfobaseMapAsync(agent, clusterId, stoppingToken);
                    var sessions = await rac.GetSessionsAsync(agent, clusterId, dbMap, stoppingToken);

                    var stats = ClientSessionStatsCalculator.ComputeClientStats(clients, sessions);

                    if (agent.KillModeEnabled)
                    {
                        await enforcer.EnforceAsync(agent, clusterId, clients, sessions, stats, stoppingToken);
                    }

                    await store.WriteMetricBucketSafeAsync(agentId, ClusterStatus.Online, sessions.Count, clients, stoppingToken, stats, sys);
                }
                catch (FileNotFoundException ex)
                {
                    var now = DateTime.UtcNow;
                    if (now - _lastRacNotFoundLogUtc > TimeSpan.FromMinutes(5))
                    {
                        _lastRacNotFoundLogUtc = now;
                        logger.LogWarning("RAC not found: {Path}. Configure RAC path in Control UI.", ex.FileName);
                        try
                        {
                            await store.WriteEventAsync(agentId, EventLevel.Warning,
                                $"RAC не найден: {ex.FileName}. Укажите путь к rac.exe в веб-настройках.", stoppingToken);
                        }
                        catch { }
                    }

                    await store.UpdateClusterStatusAsync(agentId, ClusterStatus.Unknown, stoppingToken);
                    await store.WriteMetricBucketSafeAsync(agentId, ClusterStatus.Unknown, totalSessions: 0, clients, stoppingToken, sys: sys);
                }
                catch (TimeoutException ex)
                {
                    var now = DateTime.UtcNow;
                    if (now - _lastRacErrorLogUtc > TimeSpan.FromMinutes(5))
                    {
                        _lastRacErrorLogUtc = now;
                        logger.LogWarning(ex, "RAC timeout");
                    }

                    await store.UpdateClusterStatusAsync(agentId, ClusterStatus.Unknown, stoppingToken);
                    await store.WriteMetricBucketSafeAsync(agentId, ClusterStatus.Unknown, totalSessions: 0, clients, stoppingToken, sys: sys);
                }
                catch (Exception ex)
                {
                    var now = DateTime.UtcNow;
                    if (now - _lastRacErrorLogUtc > TimeSpan.FromMinutes(2))
                    {
                        _lastRacErrorLogUtc = now;
                        logger.LogError(ex, "RAC iteration failed");
                    }

                    await store.UpdateClusterStatusAsync(agentId, ClusterStatus.Unknown, stoppingToken);
                    await store.WriteMetricBucketSafeAsync(agentId, ClusterStatus.Unknown, totalSessions: 0, clients, stoppingToken, sys: sys);
                }

                var poll = Math.Clamp(agent.PollIntervalSeconds, 5, 3600);
                await Task.Delay(TimeSpan.FromSeconds(poll), stoppingToken);
            }
            catch (Exception ex)
            {
                var now = DateTime.UtcNow;
                if (now - _lastRacErrorLogUtc > TimeSpan.FromMinutes(2))
                {
                    _lastRacErrorLogUtc = now;
                    logger.LogError(ex, "Iteration failed.");
                }

                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }
}
