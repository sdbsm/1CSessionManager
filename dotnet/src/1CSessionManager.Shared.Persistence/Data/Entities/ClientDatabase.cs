namespace SessionManager.Shared.Data.Entities;

/// <summary>
/// Привязка инфобазы к клиенту (по имени, опционально с UUID инфобазы из RAC).
/// На одном агенте одна инфобаза может быть привязана только к одному клиенту.
/// </summary>
public sealed class ClientDatabase
{
    public Guid Id { get; set; }

    public Guid AgentId { get; set; }
    public AgentInstance Agent { get; set; } = null!;

    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;

    public string Name { get; set; } = null!;
    public string? InfobaseUuid { get; set; }
}


