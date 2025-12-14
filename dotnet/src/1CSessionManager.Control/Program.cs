using Microsoft.EntityFrameworkCore;
using SessionManager.Control.Services;
using SessionManager.Shared.Configuration;
using SessionManager.Shared.Data;
using SessionManager.Shared.Data.Entities;
using SessionManager.Shared.Data.Enums;
using SessionManager.Shared.Security;
using System.Diagnostics;
using System.Text;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

builder.Services.AddSingleton<SecretProtector>();
builder.Services.AddSingleton<AppSecretService>();

builder.Services.Configure<SqlLoginConnectionOptions>(builder.Configuration.GetSection("Database:Sql"));
builder.Services.AddSingleton<WindowsCredentialStore>();
builder.Services.AddSingleton<SqlDbEndpointSecretStore>();
builder.Services.AddSingleton<SqlLoginSecretStore>();
builder.Services.AddSingleton<SqlLoginConnectionStringProvider>();
builder.Services.AddSingleton<IDbContextFactory<AppDbContext>, DynamicDbContextFactory>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseDefaultFiles();
app.UseStaticFiles();

// Redirect root to UI for best UX (keeps /settings.html accessible).
app.MapGet("/", () => Results.Redirect("/app/"));

// SPA fallback for React UI (served under /app/)
app.MapFallbackToFile("/app/{*path:nonfile}", "app/index.html");

// SQL setup endpoints (work even before DB is configured)
app.MapGet("/api/setup/db/status", (SqlDbEndpointSecretStore store, IOptions<SqlLoginConnectionOptions> fallback) =>
{
    var val = store.Read() ?? fallback.Value;
    var isSet = store.IsSet;
    return Results.Ok(new
    {
        isSet,
        value = new
        {
            server = val.Server,
            database = val.Database,
            trustServerCertificate = val.TrustServerCertificate,
            encrypt = val.Encrypt
        }
    });
});

app.MapPost("/api/setup/db", (SqlDbEndpointSetRequest req, SqlDbEndpointSecretStore store, HttpContext http) =>
{
    // bootstrap: allow only from localhost
    if (http.Connection.RemoteIpAddress is not null && !System.Net.IPAddress.IsLoopback(http.Connection.RemoteIpAddress))
        return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.Server) || string.IsNullOrWhiteSpace(req.Database))
        return Results.BadRequest(new { error = "Server and Database are required." });

    store.Write(new SqlLoginConnectionOptions
    {
        Server = req.Server.Trim(),
        Database = req.Database.Trim(),
        TrustServerCertificate = req.TrustServerCertificate ?? true,
        Encrypt = req.Encrypt ?? false
    });

    return Results.Ok(new { success = true });
});

app.MapGet("/api/setup/sql/status", (SqlLoginSecretStore store) =>
{
    var isSet = store.Read() is not null;
    return Results.Ok(new { isSet });
});

app.MapPost("/api/setup/sql", (SqlSetupRequest req, SqlLoginSecretStore store, HttpContext http) =>
{
    // bootstrap: allow only from localhost
    if (http.Connection.RemoteIpAddress is not null && !System.Net.IPAddress.IsLoopback(http.Connection.RemoteIpAddress))
        return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.UserId) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest(new { error = "UserId and Password are required." });

    store.Write(req.UserId.Trim(), req.Password);
    return Results.Ok(new { success = true });
});

// MSSQL connectivity test (SQL login stored in Windows Credential Manager).
// Works even before DB is configured; allow only from localhost.
app.MapPost("/api/setup/sql/test", async (SqlLoginConnectionStringProvider csProvider, HttpContext http, CancellationToken ct) =>
{
    if (http.Connection.RemoteIpAddress is not null && !System.Net.IPAddress.IsLoopback(http.Connection.RemoteIpAddress))
        return Results.Unauthorized();

    try
    {
        var cs = csProvider.BuildOrThrow();
        await using var conn = new Microsoft.Data.SqlClient.SqlConnection(cs);
        await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT @@VERSION";
        var version = (string?)await cmd.ExecuteScalarAsync(ct);

        return Results.Ok(new { success = true, version = version ?? "Unknown" });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, error = ex.Message });
    }
});

// API key protection for all /api/* except /api/health and /api/admin/apikey/*
// Key is stored in DB (DPAPI protected) and can be set via web UI.
string? apiKeyCache = null;

async Task EnsureApiKeyLoadedAsync()
{
    if (apiKeyCache is not null) return;
    using var scope = app.Services.CreateScope();
    var svc = scope.ServiceProvider.GetRequiredService<AppSecretService>();
    try
    {
        apiKeyCache = await svc.GetPlainAsync(AppSecretService.ApiKeySecretKey, CancellationToken.None);
    }
    catch
    {
        // DB not configured yet
        apiKeyCache = null;
    }
}

await EnsureApiKeyLoadedAsync();

app.Use(async (ctx, next) =>
{
    // Allow localhost without API key (current requirement). When you expose by IP later, enable API key.
    if (ctx.Connection.RemoteIpAddress is not null && System.Net.IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress))
    {
        await next();
        return;
    }

    // always allow health
    if (ctx.Request.Path.StartsWithSegments("/api/health"))
    {
        await next();
        return;
    }

    // bootstrap endpoints
    if (ctx.Request.Path.StartsWithSegments("/api/admin/apikey"))
    {
        await next();
        return;
    }
    if (ctx.Request.Path.StartsWithSegments("/api/setup/sql"))
    {
        await next();
        return;
    }

    if (ctx.Request.Path.StartsWithSegments("/api"))
    {
        if (!string.IsNullOrWhiteSpace(apiKeyCache))
        {
            if (!ctx.Request.Headers.TryGetValue("X-Api-Key", out var provided) || provided.Count == 0 || provided[0] != apiKeyCache)
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsync("Unauthorized");
                return;
            }
        }
    }

    await next();
});

// Optional auto-migrations (recommended for dev / first install).
if (builder.Configuration.GetValue<bool>("Database:AutoMigrate"))
{
    try
    {
        await using var db = await app.Services
            .GetRequiredService<IDbContextFactory<AppDbContext>>()
            .CreateDbContextAsync();
        await db.Database.MigrateAsync();
    }
    catch
    {
        // ignore if DB not configured yet
    }
}

// Simple health endpoint
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

// Admin: API key management (set via web, not config).
app.MapGet("/api/admin/apikey/status", async () =>
{
    await EnsureApiKeyLoadedAsync();
    return Results.Ok(new { isSet = !string.IsNullOrWhiteSpace(apiKeyCache) });
});

app.MapPost("/api/admin/apikey", async (HttpContext http, ApiKeySetRequest req, AppSecretService secrets, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(req.ApiKey) || req.ApiKey.Length < 16)
        return Results.BadRequest(new { error = "ApiKey must be at least 16 chars." });

    await EnsureApiKeyLoadedAsync();

    // If already set, require old key.
    if (!string.IsNullOrWhiteSpace(apiKeyCache))
    {
        if (!http.Request.Headers.TryGetValue("X-Api-Key", out var provided) || provided.Count == 0 || provided[0] != apiKeyCache)
            return Results.Unauthorized();
    }
    else
    {
        // bootstrap: allow only from localhost
        if (http.Connection.RemoteIpAddress is not null && !System.Net.IPAddress.IsLoopback(http.Connection.RemoteIpAddress))
            return Results.Unauthorized();
    }

    await secrets.SetPlainAsync(AppSecretService.ApiKeySecretKey, req.ApiKey, ct);
    apiKeyCache = req.ApiKey;
    return Results.Ok(new { success = true });
});

// Agent settings (passwords are never returned)
app.MapGet("/api/agent/settings", async (Guid agentId, IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, ct);
    if (agent is null) return Results.NotFound();

    return Results.Ok(new AgentSettingsResponse(
        AgentId: agent.Id,
        Enabled: agent.Enabled,
        RacPath: agent.RacPath,
        RasHost: agent.RasHost,
        ClusterUser: agent.ClusterUser,
        ClusterPassIsSet: !string.IsNullOrWhiteSpace(agent.ClusterPassProtected),
        KillModeEnabled: agent.KillModeEnabled,
        PollIntervalSeconds: agent.PollIntervalSeconds
    ));
});

app.MapPost("/api/agent/settings", async (
    Guid agentId,
    AgentSettingsUpdateRequest req,
    IDbContextFactory<AppDbContext> dbFactory,
    SecretProtector protector,
    CancellationToken ct) =>
{
    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, ct);
    if (agent is null) return Results.NotFound();

    if (req.Enabled is not null) agent.Enabled = req.Enabled.Value;
    if (!string.IsNullOrWhiteSpace(req.RacPath)) agent.RacPath = req.RacPath.Trim();
    if (!string.IsNullOrWhiteSpace(req.RasHost)) agent.RasHost = req.RasHost.Trim();
    if (req.ClusterUser is not null) agent.ClusterUser = req.ClusterUser.Trim();
    if (req.KillModeEnabled is not null) agent.KillModeEnabled = req.KillModeEnabled.Value;
    if (req.PollIntervalSeconds is not null) agent.PollIntervalSeconds = Math.Clamp(req.PollIntervalSeconds.Value, 5, 3600);

    // Password rule:
    // - null => don't change
    // - empty string => keep as-is (we don't support "clear" yet)
    // - non-empty => overwrite with protected value
    if (req.ClusterPass is not null && !string.IsNullOrWhiteSpace(req.ClusterPass))
    {
        agent.ClusterPassProtected = protector.ProtectToBase64(req.ClusterPass);
    }

    await db.SaveChangesAsync(ct);

    return Results.Ok(new { success = true });
});

// Agents list (for UI later)
app.MapGet("/api/agents", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agents = await db.Agents
        .OrderBy(a => a.Name)
        .Select(a => new
        {
            a.Id,
            a.Name,
            a.Hostname,
            a.LastSeenAtUtc,
            a.Enabled,
            a.LastKnownClusterStatus
        })
        .ToListAsync(ct);

    return Results.Ok(agents);
});

// Compatibility API for legacy React UI (no agentId query param)
static async Task<Guid?> GetDefaultAgentIdAsync(IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct)
{
    await using var db = await dbFactory.CreateDbContextAsync(ct);
    return await db.Agents.OrderBy(a => a.CreatedAtUtc).Select(a => (Guid?)a.Id).FirstOrDefaultAsync(ct);
}

static string ToLegacyLevel(EventLevel level) => level switch
{
    EventLevel.Info => "info",
    EventLevel.Warning => "warning",
    EventLevel.Critical => "critical",
    _ => "info"
};

static string ToLegacyClientStatus(ClientStatus status) => status switch
{
    ClientStatus.Active => "active",
    ClientStatus.Warning => "warning",
    ClientStatus.Blocked => "blocked",
    _ => "active"
};

static ClientStatus ParseLegacyClientStatus(string? status) => status?.ToLowerInvariant() switch
{
    "blocked" => ClientStatus.Blocked,
    "warning" => ClientStatus.Warning,
    _ => ClientStatus.Active
};

app.MapGet("/api/clients", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(Array.Empty<object>());

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var clients = await db.Clients
        .Where(c => c.AgentId == agentId.Value)
        .Include(c => c.Databases)
        .OrderBy(c => c.Name)
        .ToListAsync(ct);

    // latest per-client bucket
    var latestBucketTime = await db.ClientMetricBuckets
        .Where(x => x.AgentId == agentId.Value)
        .MaxAsync(x => (DateTime?)x.BucketStartUtc, ct);

    Dictionary<Guid, int> activeMap = new();
    if (latestBucketTime is not null)
    {
        activeMap = await db.ClientMetricBuckets.AsNoTracking()
            .Where(x => x.AgentId == agentId.Value && x.BucketStartUtc == latestBucketTime.Value)
            .ToDictionaryAsync(x => x.ClientId, x => x.ActiveSessions, ct);
    }

    var result = clients.Select(c => new
    {
        id = c.Id.ToString("D"),
        name = c.Name,
        maxSessions = c.MaxSessions,
        databases = c.Databases.Select(d => new { name = d.Name, activeSessions = 0 }).ToArray(),
        activeSessions = activeMap.GetValueOrDefault(c.Id, 0),
        status = ToLegacyClientStatus(c.Status)
    });

    return Results.Ok(result);
});

app.MapPost("/api/clients", async (LegacyClientCreateRequest req, IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.BadRequest(new { error = "No agent registered yet. Start Agent first." });

    if (string.IsNullOrWhiteSpace(req.Name))
        return Results.BadRequest(new { error = "Client name is required" });

    await using var db = await dbFactory.CreateDbContextAsync(ct);

    var client = new Client
    {
        Id = Guid.NewGuid(),
        AgentId = agentId.Value,
        Name = req.Name.Trim(),
        MaxSessions = Math.Max(0, req.MaxSessions),
        Status = ParseLegacyClientStatus(req.Status),
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow
    };

    foreach (var dbName in (req.Databases ?? Array.Empty<LegacyClientDatabase>()).Select(d => d.Name).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct(StringComparer.OrdinalIgnoreCase))
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

    return Results.Ok(new
    {
        id = client.Id.ToString("D"),
        name = client.Name,
        maxSessions = client.MaxSessions,
        databases = client.Databases.Select(d => new { name = d.Name, activeSessions = 0 }).ToArray(),
        activeSessions = 0,
        status = ToLegacyClientStatus(client.Status)
    });
});

app.MapPut("/api/clients/{id}", async (string id, LegacyClientUpdateRequest req, IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    if (!Guid.TryParse(id, out var clientId))
        return Results.BadRequest(new { error = "Invalid client id" });

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var client = await db.Clients.Include(c => c.Databases).FirstOrDefaultAsync(c => c.Id == clientId, ct);
    if (client is null) return Results.NotFound();

    if (!string.IsNullOrWhiteSpace(req.Name)) client.Name = req.Name.Trim();
    if (req.MaxSessions is not null) client.MaxSessions = Math.Max(0, req.MaxSessions.Value);
    if (req.Status is not null) client.Status = ParseLegacyClientStatus(req.Status);
    client.UpdatedAtUtc = DateTime.UtcNow;

    // Replace DB list
    db.ClientDatabases.RemoveRange(client.Databases);
    client.Databases.Clear();
    foreach (var dbName in (req.Databases ?? Array.Empty<LegacyClientDatabase>()).Select(d => d.Name).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct(StringComparer.OrdinalIgnoreCase))
    {
        client.Databases.Add(new ClientDatabase
        {
            Id = Guid.NewGuid(),
            AgentId = client.AgentId,
            ClientId = client.Id,
            Name = dbName.Trim()
        });
    }

    await db.SaveChangesAsync(ct);
    return Results.Ok(new
    {
        id = client.Id.ToString("D"),
        name = client.Name,
        maxSessions = client.MaxSessions,
        databases = client.Databases.Select(d => new { name = d.Name, activeSessions = 0 }).ToArray(),
        activeSessions = 0,
        status = ToLegacyClientStatus(client.Status)
    });
});

app.MapDelete("/api/clients/{id}", async (string id, IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    if (!Guid.TryParse(id, out var clientId))
        return Results.BadRequest(new { error = "Invalid client id" });

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == clientId, ct);
    if (client is null) return Results.NotFound();
    db.Clients.Remove(client);
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { success = true });
});

// Events (for UI, with basic filtering)
app.MapGet("/api/events", async (
    Guid? agentId,
    int? take,
    IDbContextFactory<AppDbContext> dbFactory,
    CancellationToken ct) =>
{
    var resolvedAgentId = agentId ?? await GetDefaultAgentIdAsync(dbFactory, ct);
    if (resolvedAgentId is null) return Results.Ok(Array.Empty<object>());

    await using var db = await dbFactory.CreateDbContextAsync(ct);

    var items = await db.Events.AsNoTracking()
        .Where(e => e.AgentId == resolvedAgentId.Value)
        .OrderByDescending(e => e.TimestampUtc)
        .Take(Math.Clamp(take ?? 100, 1, 5000))
        .ToListAsync(ct);

    var ru = CultureInfo.GetCultureInfo("ru-RU");
    var legacy = items.Select(e => new
    {
        id = e.Id.ToString(CultureInfo.InvariantCulture),
        timestamp = DateTime.SpecifyKind(e.TimestampUtc, DateTimeKind.Utc).ToLocalTime().ToString("G", ru),
        level = ToLegacyLevel(e.Level),
        message = e.Message
    });

    return Results.Ok(legacy);
});

app.MapDelete("/api/events", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(new { success = true });

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var rows = await db.Events.Where(e => e.AgentId == agentId.Value).ToListAsync(ct);
    db.Events.RemoveRange(rows);
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { success = true, message = "Events cleared" });
});

// Legacy settings endpoint (maps to default agent settings)
app.MapGet("/api/settings", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(new { });

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId.Value, ct);
    if (agent is null) return Results.Ok(new { });

    return Results.Ok(new
    {
        racPath = agent.RacPath,
        rasHost = agent.RasHost,
        clusterUser = agent.ClusterUser ?? "",
        clusterPass = string.IsNullOrWhiteSpace(agent.ClusterPassProtected) ? "" : "***ENCRYPTED***",
        checkInterval = agent.PollIntervalSeconds,
        killMode = agent.KillModeEnabled
    });
});

app.MapPost("/api/settings", async (JsonElement body, IDbContextFactory<AppDbContext> dbFactory, SecretProtector protector, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.BadRequest(new { error = "No agent registered yet. Start Agent first." });

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.FirstAsync(a => a.Id == agentId.Value, ct);

    if (body.TryGetProperty("racPath", out var racPathEl) && racPathEl.ValueKind == JsonValueKind.String)
        agent.RacPath = racPathEl.GetString()!.Trim();
    if (body.TryGetProperty("rasHost", out var rasHostEl) && rasHostEl.ValueKind == JsonValueKind.String)
        agent.RasHost = rasHostEl.GetString()!.Trim();
    if (body.TryGetProperty("clusterUser", out var cuEl) && cuEl.ValueKind == JsonValueKind.String)
        agent.ClusterUser = cuEl.GetString()!.Trim();
    if (body.TryGetProperty("checkInterval", out var ciEl) && ciEl.TryGetInt32(out var ci))
        agent.PollIntervalSeconds = Math.Clamp(ci, 5, 3600);
    if (body.TryGetProperty("killMode", out var kmEl) && (kmEl.ValueKind == JsonValueKind.True || kmEl.ValueKind == JsonValueKind.False))
        agent.KillModeEnabled = kmEl.GetBoolean();

    // Password semantics:
    // - "***ENCRYPTED***" or missing => keep
    // - empty string => keep (legacy UI sends empty when not changing)
    // - non-empty => overwrite (DPAPI-protected)
    if (body.TryGetProperty("clusterPass", out var cpEl) && cpEl.ValueKind == JsonValueKind.String)
    {
        var cp = cpEl.GetString() ?? "";
        if (!string.IsNullOrWhiteSpace(cp) && cp != "***ENCRYPTED***")
            agent.ClusterPassProtected = protector.ProtectToBase64(cp);
    }

    await db.SaveChangesAsync(ct);

    return Results.Ok(new
    {
        racPath = agent.RacPath,
        rasHost = agent.RasHost,
        clusterUser = agent.ClusterUser ?? "",
        clusterPass = string.IsNullOrWhiteSpace(agent.ClusterPassProtected) ? "" : "***ENCRYPTED***",
        checkInterval = agent.PollIntervalSeconds,
        killMode = agent.KillModeEnabled
    });
});

// Legacy test-connection endpoint
app.MapPost("/api/test-connection", async (JsonElement body, IDbContextFactory<AppDbContext> dbFactory, SecretProtector protector, CancellationToken ct) =>
{
    // body can override racPath/rasHost for test
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(new { success = false, error = "Agent not registered yet. Start Agent first." });

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.FirstAsync(a => a.Id == agentId.Value, ct);

    var racPath = agent.RacPath;
    var rasHost = agent.RasHost;
    var clusterUser = agent.ClusterUser;
    string? clusterPassPlain = null;

    if (body.TryGetProperty("racPath", out var rpEl) && rpEl.ValueKind == JsonValueKind.String) racPath = rpEl.GetString()!.Trim();
    if (body.TryGetProperty("rasHost", out var rhEl) && rhEl.ValueKind == JsonValueKind.String) rasHost = rhEl.GetString()!.Trim();
    if (body.TryGetProperty("clusterUser", out var cuEl) && cuEl.ValueKind == JsonValueKind.String) clusterUser = cuEl.GetString()!.Trim();
    if (body.TryGetProperty("clusterPass", out var cpEl) && cpEl.ValueKind == JsonValueKind.String)
    {
        var cp = cpEl.GetString() ?? "";
        if (!string.IsNullOrWhiteSpace(cp) && cp != "***ENCRYPTED***") clusterPassPlain = cp;
    }

    if (clusterPassPlain is null && !string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
    {
        try { clusterPassPlain = protector.UnprotectFromBase64(agent.ClusterPassProtected); } catch { /* ignore */ }
    }

    try
    {
        var output = await RunRacAsync(racPath, rasHost, ["cluster", "list"], clusterUser, clusterPassPlain, ct);
        if (output is null) return Results.Ok(new { success = false, error = "Соединение не установлено. Проверьте путь к rac.exe и адрес RAS." });
        return Results.Ok(new { success = true, output });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, error = $"Ошибка: {ex.Message}" });
    }
});

// Legacy server info endpoint
app.MapGet("/api/server/info", () =>
{
    return Results.Ok(new
    {
        hostname = Environment.MachineName,
        osVersion = System.Runtime.InteropServices.RuntimeInformation.OSDescription
    });
});

// Legacy infobases endpoint
app.MapGet("/api/infobases", async (IDbContextFactory<AppDbContext> dbFactory, SecretProtector protector, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(Array.Empty<object>());

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.FirstAsync(a => a.Id == agentId.Value, ct);

    string? pass = null;
    if (!string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
    {
        try { pass = protector.UnprotectFromBase64(agent.ClusterPassProtected); } catch { pass = null; }
    }

    var clusterListOut = await RunRacAsync(agent.RacPath, agent.RasHost, ["cluster", "list"], agent.ClusterUser, pass, ct);
    var clusters = ParseBlocks(clusterListOut);
    var clusterId = clusters.FirstOrDefault()?.GetValueOrDefault("cluster");
    if (string.IsNullOrWhiteSpace(clusterId)) return Results.Ok(Array.Empty<object>());

    var outStr = await RunRacAsync(agent.RacPath, agent.RasHost, ["infobase", "summary", "list", $"--cluster={clusterId}"], agent.ClusterUser, pass, ct);
    var list = ParseBlocks(outStr);

    var result = list
        .Select(item => new
        {
            name = item.GetValueOrDefault("name") ?? "",
            uuid = item.GetValueOrDefault("infobase") ?? item.GetValueOrDefault("uuid") ?? item.GetValueOrDefault("infobase_id") ?? ""
        })
        .Where(x => !string.IsNullOrWhiteSpace(x.name) && !string.IsNullOrWhiteSpace(x.uuid))
        .ToArray();

    return Results.Ok(result);
});

// Dashboard endpoints (minimal compatibility)
var dashboardCacheObj = (object?)null;
var dashboardCacheAtUtc = DateTime.MinValue;
var dashboardCacheTtl = TimeSpan.FromSeconds(5);

app.MapGet("/api/dashboard/stats", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    // Cheap in-memory cache (UI polls every 10s; this avoids accidental double-hit)
    if (dashboardCacheObj is not null && (DateTime.UtcNow - dashboardCacheAtUtc) < dashboardCacheTtl)
        return Results.Ok(dashboardCacheObj);

    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null)
    {
        dashboardCacheObj = new { databaseStats = new Dictionary<string, object>(), connectionTypes = new Dictionary<string, int>(), clusterStatus = "unknown", serverMetrics = new { cpu = 0, memory = new { used = 0, total = 0, percent = 0 } }, lastUpdate = (string?)null };
        dashboardCacheAtUtc = DateTime.UtcNow;
        return Results.Ok(dashboardCacheObj);
    }

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var agent = await db.Agents.AsNoTracking().FirstAsync(a => a.Id == agentId.Value, ct);

    string? pass = null;
    if (!string.IsNullOrWhiteSpace(agent.ClusterPassProtected))
    {
        try { pass = new SecretProtector().UnprotectFromBase64(agent.ClusterPassProtected); } catch { pass = null; }
    }

    string clusterStatus;
    var connectionTypes = new Dictionary<string, int> { ["1CV8"] = 0, ["1CV8C"] = 0, ["WebClient"] = 0, ["App"] = 0 };
    var databaseStats = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    string? debugError = null;
    var debug = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
    {
        ["racPath"] = agent.RacPath,
        ["racExists"] = File.Exists(agent.RacPath.Trim().Trim('"')),
        ["rasHost"] = agent.RasHost,
        ["clusterUserSet"] = !string.IsNullOrWhiteSpace(agent.ClusterUser),
        ["clusterPassSet"] = !string.IsNullOrWhiteSpace(agent.ClusterPassProtected)
    };

    try
    {
        var clusterListOut = await RunRacAsync(agent.RacPath, agent.RasHost, ["cluster", "list"], agent.ClusterUser, pass, ct);
        var clusters = ParseBlocks(clusterListOut);
        var clusterId = clusters.FirstOrDefault()?.GetValueOrDefault("cluster");
        if (string.IsNullOrWhiteSpace(clusterId))
        {
            clusterStatus = "offline";
        }
        else
        {
            clusterStatus = "online";

            // Infobases: uuid -> name, and list of all DB names
            var infobaseOut = await RunRacAsync(agent.RacPath, agent.RasHost, ["infobase", "summary", "list", $"--cluster={clusterId}"], agent.ClusterUser, pass, ct);
            var infobases = ParseBlocks(infobaseOut);
            var uuidToName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var allDbNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in infobases)
            {
                var uid = item.GetValueOrDefault("infobase") ?? item.GetValueOrDefault("uuid") ?? item.GetValueOrDefault("infobase_id");
                var name = item.GetValueOrDefault("name");
                if (!string.IsNullOrWhiteSpace(uid) && !string.IsNullOrWhiteSpace(name))
                {
                    uuidToName[uid] = name;
                    allDbNames.Add(name);
                }
            }

            // Sessions
            var sessOut = await RunRacAsync(agent.RacPath, agent.RasHost, ["session", "list", $"--cluster={clusterId}"], agent.ClusterUser, pass, ct);
            var sessions = ParseBlocks(sessOut);
            var dbCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var s in sessions)
            {
                var appId = s.GetValueOrDefault("app_id") ?? "";
                if (connectionTypes.ContainsKey(appId))
                    connectionTypes[appId]++;

                var infobaseUuid = s.GetValueOrDefault("infobase") ?? s.GetValueOrDefault("infobase_id");
                if (string.IsNullOrWhiteSpace(infobaseUuid)) continue;
                if (!uuidToName.TryGetValue(infobaseUuid, out var dbName)) continue;

                dbCounts[dbName] = dbCounts.GetValueOrDefault(dbName) + 1;
            }

            // Fill databaseStats with all DBs (including zero-session ones)
            foreach (var dbName in allDbNames)
            {
                databaseStats[dbName] = new { sessions = dbCounts.GetValueOrDefault(dbName), sizeMB = (double?)null };
            }
        }
    }
    catch (Exception ex)
    {
        clusterStatus = "unknown";
        debugError = ex.Message;
    }

    dashboardCacheObj = new
    {
        databaseStats,
        connectionTypes,
        clusterStatus,
        // TODO: add real CPU/RAM metrics (agent can publish later)
        serverMetrics = new { cpu = 0, memory = new { used = 0, total = 0, percent = 0 } },
        lastUpdate = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
        debug = app.Environment.IsDevelopment() ? new { error = debugError, info = debug } : null
    };
    dashboardCacheAtUtc = DateTime.UtcNow;
    return Results.Ok(dashboardCacheObj);
});

app.MapGet("/api/dashboard/top-clients", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(Array.Empty<object>());

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var clients = await db.Clients.Where(c => c.AgentId == agentId.Value).ToListAsync(ct);
    var latestBucketTime = await db.ClientMetricBuckets
        .Where(x => x.AgentId == agentId.Value)
        .MaxAsync(x => (DateTime?)x.BucketStartUtc, ct);

    Dictionary<Guid, int> activeMap = new();
    if (latestBucketTime is not null)
    {
        activeMap = await db.ClientMetricBuckets.AsNoTracking()
            .Where(x => x.AgentId == agentId.Value && x.BucketStartUtc == latestBucketTime.Value)
            .ToDictionaryAsync(x => x.ClientId, x => x.ActiveSessions, ct);
    }

    var top = clients
        .Where(c => c.MaxSessions > 0)
        .Select(c =>
        {
            var active = activeMap.GetValueOrDefault(c.Id, 0);
            var util = c.MaxSessions > 0 ? (int)Math.Round((double)active / c.MaxSessions * 100) : 0;
            return new { id = c.Id.ToString("D"), name = c.Name, activeSessions = active, maxSessions = c.MaxSessions, utilization = util, status = ToLegacyClientStatus(c.Status) };
        })
        .OrderByDescending(x => x.activeSessions)
        .Take(5)
        .ToArray();

    return Results.Ok(top);
});

app.MapGet("/api/dashboard/warnings", async (IDbContextFactory<AppDbContext> dbFactory, CancellationToken ct) =>
{
    var agentId = await GetDefaultAgentIdAsync(dbFactory, ct);
    if (agentId is null) return Results.Ok(Array.Empty<object>());

    await using var db = await dbFactory.CreateDbContextAsync(ct);
    var clients = await db.Clients.Where(c => c.AgentId == agentId.Value).ToListAsync(ct);
    var latestBucketTime = await db.ClientMetricBuckets
        .Where(x => x.AgentId == agentId.Value)
        .MaxAsync(x => (DateTime?)x.BucketStartUtc, ct);

    Dictionary<Guid, int> activeMap = new();
    if (latestBucketTime is not null)
    {
        activeMap = await db.ClientMetricBuckets.AsNoTracking()
            .Where(x => x.AgentId == agentId.Value && x.BucketStartUtc == latestBucketTime.Value)
            .ToDictionaryAsync(x => x.ClientId, x => x.ActiveSessions, ct);
    }

    var warnings = clients
        .Select(c =>
        {
            var active = activeMap.GetValueOrDefault(c.Id, 0);
            var util = c.MaxSessions > 0 ? (int)Math.Round((double)active / c.MaxSessions * 100) : 0;
            var warn = c.Status == ClientStatus.Blocked || (c.MaxSessions > 0 && util >= 80);
            var reason = c.Status == ClientStatus.Blocked ? "Заблокирован" : (util >= 100 ? "Лимит превышен" : "Высокая загрузка (>80%)");
            return new { id = c.Id.ToString("D"), name = c.Name, activeSessions = active, maxSessions = c.MaxSessions, utilization = util, status = ToLegacyClientStatus(c.Status), reason, warn };
        })
        .Where(x => x.warn)
        .Select(x => new { x.id, x.name, x.activeSessions, x.maxSessions, x.utilization, x.status, x.reason })
        .ToArray();

    return Results.Ok(warnings);
});

// --- Helpers: RAC runner + parser (kept small; we’ll refactor to Shared later) ---
static async Task<string?> RunRacAsync(string racPath, string rasHost, IReadOnlyList<string> args, string? clusterUser, string? clusterPass, CancellationToken ct)
{
    Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    var enc = Encoding.GetEncoding(866);

    racPath = racPath.Trim().Trim('"');
    if (!File.Exists(racPath))
        throw new FileNotFoundException("rac.exe not found", racPath);

    var psi = new ProcessStartInfo
    {
        FileName = racPath,
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        StandardOutputEncoding = enc,
        StandardErrorEncoding = enc
    };

    foreach (var a in args) psi.ArgumentList.Add(a);
    if (!string.IsNullOrWhiteSpace(clusterUser))
    {
        psi.ArgumentList.Add($"--cluster-user={clusterUser}");
        psi.ArgumentList.Add($"--cluster-pwd={clusterPass ?? ""}");
    }
    psi.ArgumentList.Add(rasHost.Trim());

    using var proc = new Process { StartInfo = psi };
    proc.Start();
    var stdoutTask = proc.StandardOutput.ReadToEndAsync(ct);
    var stderrTask = proc.StandardError.ReadToEndAsync(ct);
    await proc.WaitForExitAsync(ct);
    var stdout = await stdoutTask;
    var stderr = await stderrTask;
    if (proc.ExitCode != 0) return null;
    return stdout;
}

static IReadOnlyList<Dictionary<string, string>> ParseBlocks(string? output)
{
    if (string.IsNullOrWhiteSpace(output))
        return Array.Empty<Dictionary<string, string>>();

    var normalized = output.Replace("\r\n", "\n");
    var blocks = normalized.Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    var list = new List<Dictionary<string, string>>(blocks.Length);

    foreach (var block in blocks)
    {
        var item = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var lines = block.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var line in lines)
        {
            var idx = line.IndexOf(':');
            if (idx <= 0) continue;
            var key = line[..idx].Trim().TrimStart('\uFEFF').ToLowerInvariant().Replace("-", "_").Replace(" ", "_");
            var val = line[(idx + 1)..].Trim().Trim('"');
            if (key.Length > 0) item[key] = val;
        }
        if (item.Count > 0) list.Add(item);
    }

    return list;
}

// Metrics (minute buckets)
app.MapGet("/api/metrics/agent", async (
    Guid agentId,
    DateTime? fromUtc,
    DateTime? toUtc,
    int? take,
    IDbContextFactory<AppDbContext> dbFactory,
    CancellationToken ct) =>
{
    await using var db = await dbFactory.CreateDbContextAsync(ct);

    var q = db.AgentMetricBuckets.AsNoTracking().Where(x => x.AgentId == agentId);
    if (fromUtc is not null) q = q.Where(x => x.BucketStartUtc >= fromUtc.Value);
    if (toUtc is not null) q = q.Where(x => x.BucketStartUtc <= toUtc.Value);

    var items = await q
        .OrderByDescending(x => x.BucketStartUtc)
        .Take(Math.Clamp(take ?? 1440, 1, 20000)) // default: 1 day of minute buckets
        .ToListAsync(ct);

    return Results.Ok(items);
});

app.MapGet("/api/metrics/clients", async (
    Guid agentId,
    DateTime? fromUtc,
    DateTime? toUtc,
    int? take,
    IDbContextFactory<AppDbContext> dbFactory,
    CancellationToken ct) =>
{
    await using var db = await dbFactory.CreateDbContextAsync(ct);

    var q = db.ClientMetricBuckets.AsNoTracking().Where(x => x.AgentId == agentId);
    if (fromUtc is not null) q = q.Where(x => x.BucketStartUtc >= fromUtc.Value);
    if (toUtc is not null) q = q.Where(x => x.BucketStartUtc <= toUtc.Value);

    var items = await q
        .OrderByDescending(x => x.BucketStartUtc)
        .Take(Math.Clamp(take ?? 5000, 1, 50000))
        .ToListAsync(ct);

    return Results.Ok(items);
});

app.Run();

internal sealed record ApiKeySetRequest(string ApiKey);
internal sealed record SqlSetupRequest(string UserId, string Password);
internal sealed record SqlDbEndpointSetRequest(string Server, string Database, bool? TrustServerCertificate, bool? Encrypt);
internal sealed record LegacyClientDatabase(string Name);
internal sealed record LegacyClientCreateRequest(string Name, int MaxSessions, string? Status, LegacyClientDatabase[]? Databases);
internal sealed record LegacyClientUpdateRequest(string? Name, int? MaxSessions, string? Status, LegacyClientDatabase[]? Databases);
