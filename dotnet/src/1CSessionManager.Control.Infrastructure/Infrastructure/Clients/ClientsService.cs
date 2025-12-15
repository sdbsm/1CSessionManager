using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Application.Clients;
using SessionManager.Control.Infrastructure.Agents;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Data.Enums;

namespace SessionManager.Control.Infrastructure.Clients;

public sealed class ClientsService(IDbContextFactory<AppDbContext> dbFactory) : IClientsService
{
    public async Task<IReadOnlyList<ClientDto>> ListAsync(CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null) return Array.Empty<ClientDto>();

        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var clients = await db.Clients
            .Where(c => c.AgentId == agentId.Value)
            .Include(c => c.Databases)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        var latestBucketTime = await db.ClientMetricBuckets
            .Where(x => x.AgentId == agentId.Value)
            .MaxAsync(x => (DateTime?)x.BucketStartUtc, ct);

        Dictionary<Guid, (int ActiveSessions, Dictionary<string, int> DbCounts)> metricMap = new();
        if (latestBucketTime is not null)
        {
            var metrics = await db.ClientMetricBuckets.AsNoTracking()
                .Where(x => x.AgentId == agentId.Value && x.BucketStartUtc == latestBucketTime.Value)
                .Select(x => new { x.ClientId, x.ActiveSessions, x.DatabaseMetricJson })
                .ToListAsync(ct);

            foreach (var m in metrics)
            {
                var dbCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrWhiteSpace(m.DatabaseMetricJson))
                {
                    try { dbCounts = JsonSerializer.Deserialize<Dictionary<string, int>>(m.DatabaseMetricJson) ?? dbCounts; } catch { }
                }
                metricMap[m.ClientId] = (m.ActiveSessions, dbCounts);
            }
        }

        return clients.Select(c =>
        {
            var (active, dbCounts) = metricMap.GetValueOrDefault(c.Id, (0, new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)));
            dbCounts ??= new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            var databases = c.Databases
                .Select(d => new ClientDatabaseDto(d.Name, dbCounts.GetValueOrDefault(d.Name, 0)))
                .ToArray();

            return new ClientDto(
                Id: c.Id.ToString("D"),
                Name: c.Name,
                MaxSessions: c.MaxSessions,
                Databases: databases,
                ActiveSessions: active,
                Status: ToApiClientStatus(c.Status));
        }).ToArray();
    }

    public async Task<ClientDto> CreateAsync(CreateClientRequest req, CancellationToken ct)
    {
        var agentId = await AgentResolver.GetDefaultAgentIdAsync(dbFactory, ct);
        if (agentId is null)
            throw new InvalidOperationException("No agent registered yet. Start Agent first.");

        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Client name is required", nameof(req));

        await using var db = await dbFactory.CreateDbContextAsync(ct);

        var client = new Client
        {
            Id = Guid.NewGuid(),
            AgentId = agentId.Value,
            Name = req.Name.Trim(),
            MaxSessions = Math.Max(0, req.MaxSessions),
            Status = ParseClientStatus(req.Status),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        foreach (var dbName in (req.Databases ?? Array.Empty<ClientDatabaseUpsertRequest>())
                     .Select(d => d.Name)
                     .Where(n => !string.IsNullOrWhiteSpace(n))
                     .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            client.Databases.Add(new ClientDatabase
            {
                Id = Guid.NewGuid(),
                AgentId = agentId.Value,
                ClientId = client.Id,
                Name = dbName.Trim(),
                InfobaseUuid = null
            });
        }

        db.Clients.Add(client);
        await db.SaveChangesAsync(ct);

        return new ClientDto(
            Id: client.Id.ToString("D"),
            Name: client.Name,
            MaxSessions: client.MaxSessions,
            Databases: client.Databases.Select(d => new ClientDatabaseDto(d.Name, 0)).ToArray(),
            ActiveSessions: 0,
            Status: ToApiClientStatus(client.Status));
    }

    public async Task<ClientDto?> UpdateAsync(Guid clientId, UpdateClientRequest req, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);

        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == clientId, ct);
        if (client is null) return null;

        if (!string.IsNullOrWhiteSpace(req.Name)) client.Name = req.Name.Trim();
        if (req.MaxSessions is not null) client.MaxSessions = Math.Max(0, req.MaxSessions.Value);
        if (req.Status is not null) client.Status = ParseClientStatus(req.Status);
        client.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var existingDbs = await db.ClientDatabases.Where(d => d.ClientId == clientId).ToListAsync(ct);
        db.ClientDatabases.RemoveRange(existingDbs);

        foreach (var dbName in (req.Databases ?? Array.Empty<ClientDatabaseUpsertRequest>())
                     .Select(d => d.Name)
                     .Where(n => !string.IsNullOrWhiteSpace(n))
                     .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            db.ClientDatabases.Add(new ClientDatabase
            {
                Id = Guid.NewGuid(),
                AgentId = client.AgentId,
                ClientId = client.Id,
                Name = dbName.Trim()
            });
        }

        await db.SaveChangesAsync(ct);

        var updatedClient = await db.Clients
            .AsNoTracking()
            .Include(c => c.Databases)
            .FirstAsync(c => c.Id == clientId, ct);

        return new ClientDto(
            Id: updatedClient.Id.ToString("D"),
            Name: updatedClient.Name,
            MaxSessions: updatedClient.MaxSessions,
            Databases: updatedClient.Databases.Select(d => new ClientDatabaseDto(d.Name, 0)).ToArray(),
            ActiveSessions: 0,
            Status: ToApiClientStatus(updatedClient.Status));
    }

    public async Task<bool> DeleteAsync(Guid clientId, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == clientId, ct);
        if (client is null) return false;
        db.Clients.Remove(client);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static string ToApiClientStatus(ClientStatus status) => status switch
    {
        ClientStatus.Active => "active",
        ClientStatus.Warning => "warning",
        ClientStatus.Blocked => "blocked",
        _ => "active"
    };

    private static ClientStatus ParseClientStatus(string? status) => status?.ToLowerInvariant() switch
    {
        "blocked" => ClientStatus.Blocked,
        "warning" => ClientStatus.Warning,
        _ => ClientStatus.Active
    };
}
