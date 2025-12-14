using SessionManager.Shared.Data.Enums;

namespace SessionManager.Shared.Data.Entities;

/// <summary>
/// События (аудит/ошибки/kill) — храним полностью год и дольше при необходимости.
/// </summary>
public sealed class SystemEvent
{
    public long Id { get; set; }

    public Guid AgentId { get; set; }
    public AgentInstance Agent { get; set; } = null!;

    public DateTime TimestampUtc { get; set; }
    public EventLevel Level { get; set; }

    public string Message { get; set; } = null!;

    // Optional context for search / reports
    public Guid? ClientId { get; set; }
    public string? ClientName { get; set; }
    public string? DatabaseName { get; set; }
    public string? SessionId { get; set; }
    public string? UserName { get; set; }
}


