using SessionManager.Shared.Data.Enums;

namespace SessionManager.Shared.Data.Entities;

/// <summary>
/// Аггрегированные метрики по клиентам (для графиков/трендов).
/// </summary>
public sealed class ClientMetricBucket
{
    public long Id { get; set; }

    public Guid AgentId { get; set; }
    public AgentInstance Agent { get; set; } = null!;

    public DateTime BucketStartUtc { get; set; }

    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;

    public int ActiveSessions { get; set; }
    public int MaxSessions { get; set; }
    public ClientStatus Status { get; set; }
}


