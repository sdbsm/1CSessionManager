using SessionManager.Agent.Monitoring;

namespace SessionManager.Agent.Ports;

public interface ISystemMetricsCollector
{
    SystemMetricsSnapshot Collect();
}
