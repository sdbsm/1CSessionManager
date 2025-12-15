namespace SessionManager.Agent.Ports;

public interface IAgentIdentityProvider
{
    Guid GetOrCreateAgentId();
}
