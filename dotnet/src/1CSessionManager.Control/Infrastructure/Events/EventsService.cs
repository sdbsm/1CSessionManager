using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Application.Events;
using SessionManager.Control.Infrastructure.Agents;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Control.Infrastructure.Events;

public sealed class EventsService(IDbContextFactory<AppDbContext> dbFactory) : IEventsService
{
    public async Task<IReadOnlyList<SystemEventDto>> ListAsync(ListEventsRequest req, CancellationToken ct)
    {
        var resolvedAgentId = req.AgentId ?? await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (resolvedAgentId is null)
            return Array.Empty<SystemEventDto>();

        await using var db = await dbFactory.CreateDbContextAsync(ct);

        var (from, to) = NormalizeUtcRange(req.FromUtc, req.ToUtc);
        var allowedLevels = ParseLevels(req.Levels);

        Guid? clientGuid = null;
        if (!string.IsNullOrWhiteSpace(req.ClientId) && Guid.TryParse(req.ClientId, out var cg)) clientGuid = cg;

        var query = db.Events.AsNoTracking().Where(e => e.AgentId == resolvedAgentId.Value);

        if (from is not null) query = query.Where(e => e.TimestampUtc >= from.Value);
        if (to is not null) query = query.Where(e => e.TimestampUtc <= to.Value);
        if (allowedLevels is not null && allowedLevels.Count > 0) query = query.Where(e => allowedLevels.Contains(e.Level));
        if (clientGuid is not null) query = query.Where(e => e.ClientId == clientGuid.Value);

        if (!string.IsNullOrWhiteSpace(req.Database))
        {
            var dbName = req.Database.Trim();
            query = query.Where(e => e.DatabaseName != null && e.DatabaseName == dbName);
        }

        if (!string.IsNullOrWhiteSpace(req.User))
        {
            var userName = req.User.Trim();
            query = query.Where(e => e.UserName != null && e.UserName == userName);
        }

        if (!string.IsNullOrWhiteSpace(req.Q))
        {
            var like = ToSqlLike(req.Q.Trim());
            query = query.Where(e =>
                EF.Functions.Like(e.Message, like) ||
                (e.ClientName != null && EF.Functions.Like(e.ClientName, like)) ||
                (e.DatabaseName != null && EF.Functions.Like(e.DatabaseName, like)) ||
                (e.UserName != null && EF.Functions.Like(e.UserName, like)) ||
                (e.SessionId != null && EF.Functions.Like(e.SessionId, like))
            );
        }

        var limit = Math.Clamp(req.Take ?? 200, 1, 5000);
        var items = await query
            .OrderByDescending(e => e.TimestampUtc)
            .Take(limit)
            .ToListAsync(ct);

        var ru = CultureInfo.GetCultureInfo("ru-RU");

        return items.Select(e =>
        {
            var utc = DateTime.SpecifyKind(e.TimestampUtc, DateTimeKind.Utc);
            var local = utc.ToLocalTime();

            return new SystemEventDto(
                Id: e.Id.ToString(CultureInfo.InvariantCulture),
                TimestampUtc: utc.ToString("O", CultureInfo.InvariantCulture),
                TimestampLocal: local.ToString("G", ru),
                Level: ToApiLevel(e.Level),
                Message: e.Message,
                ClientId: e.ClientId?.ToString("D"),
                ClientName: e.ClientName,
                DatabaseName: e.DatabaseName,
                SessionId: e.SessionId,
                UserName: e.UserName);
        }).ToArray();
    }

    public async Task ClearAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null) return;

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var rows = await db.Events.Where(e => e.AgentId == agentId.Value).ToListAsync(ct);
        db.Events.RemoveRange(rows);
        await db.SaveChangesAsync(ct);
    }

    private static (DateTime? From, DateTime? To) NormalizeUtcRange(DateTime? fromUtc, DateTime? toUtc)
    {
        var from = fromUtc;
        var to = toUtc;
        if (from is not null && from.Value.Kind == DateTimeKind.Local) from = from.Value.ToUniversalTime();
        if (to is not null && to.Value.Kind == DateTimeKind.Local) to = to.Value.ToUniversalTime();
        return (from, to);
    }

    private static HashSet<EventLevel>? ParseLevels(string? levels)
    {
        if (string.IsNullOrWhiteSpace(levels))
            return null;

        var allowed = new HashSet<EventLevel>();
        foreach (var token in levels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var t = token.Trim().ToLowerInvariant();
            allowed.Add(t switch
            {
                "critical" => EventLevel.Critical,
                "warning" => EventLevel.Warning,
                "info" => EventLevel.Info,
                _ => EventLevel.Info
            });
        }

        return allowed;
    }

    private static string ToSqlLike(string needle)
    {
        var safe = needle
            .Replace("[", "[[]")
            .Replace("%", "[%]")
            .Replace("_", "[_]")
            .Replace("]", "[]]");

        return $"%{safe}%";
    }

    private static string ToApiLevel(EventLevel level) => level switch
    {
        EventLevel.Info => "info",
        EventLevel.Warning => "warning",
        EventLevel.Critical => "critical",
        _ => "info"
    };
}
