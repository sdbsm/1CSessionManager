using SessionManager.Agent.Services;

namespace SessionManager.Agent;

public sealed class Worker(
    AgentMonitorLoop loop) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await loop.RunAsync(stoppingToken);
    }
}
