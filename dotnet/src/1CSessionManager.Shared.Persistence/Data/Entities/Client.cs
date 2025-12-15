using SessionManager.Shared.Data.Enums;

namespace SessionManager.Shared.Data.Entities;

public sealed class Client
{
    public Guid Id { get; set; }

    public Guid AgentId { get; set; }
    public AgentInstance Agent { get; set; } = null!;

    public string Name { get; set; } = null!;
    public int MaxSessions { get; set; }
    public ClientStatus Status { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public List<ClientDatabase> Databases { get; set; } = new();
}


