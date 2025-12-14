using SessionManager.Shared.Data.Enums;

namespace SessionManager.Shared.Data.Entities;

/// <summary>
/// Аггрегированные метрики агента по времени (по умолчанию — минутные бакеты).
/// Храним год: это основа для дашборда/аналитики без взрыва объёма.
/// </summary>
public sealed class AgentMetricBucket
{
    public long Id { get; set; }

    public Guid AgentId { get; set; }
    public AgentInstance Agent { get; set; } = null!;

    /// <summary>Начало бакета (UTC, округлено до минуты/интервала).</summary>
    public DateTime BucketStartUtc { get; set; }

    public ClusterStatus ClusterStatus { get; set; }

    public short CpuPercent { get; set; }
    public int MemoryUsedMb { get; set; }
    public int MemoryTotalMb { get; set; }

    public int TotalSessions { get; set; }
}


