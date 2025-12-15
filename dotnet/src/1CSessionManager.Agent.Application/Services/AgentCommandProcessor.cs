using System.Text.Json;
using Microsoft.Extensions.Logging;
using SessionManager.Agent.Ports;
using SessionManager.Shared.Data.Entities;

namespace SessionManager.Agent.Services;

public class AgentCommandProcessor(
    ILogger<AgentCommandProcessor> logger,
    IAgentDataStore store,
    IAgentIdentityProvider identity,
    IWebPublicationService webinst,
    IIisManagementService iis)
{
    public async Task ProcessPendingCommandsAsync(CancellationToken ct)
    {
        var agentId = identity.GetOrCreateAgentId();
        
        while (!ct.IsCancellationRequested)
        {
            var cmd = await store.GetNextPendingCommandAsync(agentId, ct);
            if (cmd == null) return;

            logger.LogInformation("Processing command {Type} ({Id})", cmd.CommandType, cmd.Id);

            try
            {
                await store.UpdateCommandStatusAsync(cmd.Id, "Processing", null, ct);
                await store.UpdateCommandProgressAsync(cmd.Id, 0, "Подготовка...", ct);

                switch (cmd.CommandType)
                {
                    case "PublishNew":
                        await HandlePublishNewAsync(cmd.Id, cmd.PayloadJson, ct);
                        break;
                    case "Publish":
                        await HandlePublishAsync(cmd.Id, cmd.PayloadJson, ct);
                        break;
                    case "UpdatePublicationVersion":
                        await HandleUpdatePublicationVersionAsync(cmd.Id, cmd.PayloadJson, ct);
                        break;
                    case "MassUpdateVersions":
                        await HandleMassUpdateVersionsAsync(cmd.Id, cmd.PayloadJson, ct);
                        break;
                    default:
                        throw new NotSupportedException($"Command {cmd.CommandType} not supported");
                }

                await store.UpdateCommandStatusAsync(cmd.Id, "Completed", null, ct);
                logger.LogInformation("Command {Id} completed", cmd.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Command {Id} failed", cmd.Id);
                // Preserve full error message, especially for FileNotFoundException which may truncate Message property
                var errorMsg = ex is FileNotFoundException fnf 
                    ? (fnf.Message ?? ex.ToString()) 
                    : (ex.Message ?? ex.ToString());
                await store.UpdateCommandStatusAsync(cmd.Id, "Failed", errorMsg, ct);
            }
        }
    }

    private record PublishPayload(string Version, string BaseName, string FolderPath, string ConnectionString, string? SiteName);
    private async Task HandlePublishAsync(Guid commandId, string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        logger.LogInformation("Deserializing PublishPayload from JSON: {Json}", json);
        var p = JsonSerializer.Deserialize<PublishPayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");
        
        // Ensure version is not null or empty, and preserve full string
        var version = string.IsNullOrWhiteSpace(p.Version) 
            ? throw new ArgumentException("Версия платформы не указана в команде") 
            : p.Version.Trim();
        
        logger.LogInformation("PublishPayload deserialized. Version: '{Version}' (length: {Length})", version, version.Length);

        var siteName = p.SiteName ?? "Default Web Site";
        var appPath = p.BaseName.StartsWith("/") ? p.BaseName : "/" + p.BaseName;

        await store.UpdateCommandProgressAsync(commandId, 10, $"Проверяю публикацию: {siteName}{appPath}", ct);

        // Check if exists
        var pubs = iis.GetPublications();
        var existing = pubs.FirstOrDefault(x => 
            x.SiteName.Equals(siteName, StringComparison.OrdinalIgnoreCase) && 
            x.Path.Equals(appPath, StringComparison.OrdinalIgnoreCase));

        if (existing != null)
        {
            logger.LogInformation("Publication {Path} exists. Updating version to {Version}...", appPath, version);
            await store.UpdateCommandProgressAsync(commandId, 40, $"Обновляю версию (IIS): {siteName}{appPath} → {version}", ct);
            
            // It exists. Update version safely using IIS API.
            // 1. Resolve bin path for target version
            var binPath = webinst.GetBinPath(version);
            
            // 2. Update IIS
            iis.UpdatePublicationVersion(siteName, appPath, binPath);
            await store.UpdateCommandProgressAsync(commandId, 90, "Проверяю результат...", ct);
        }
        else
        {
            logger.LogInformation("Publication {Path} does not exist. Creating new via webinst...", appPath);
            await store.UpdateCommandProgressAsync(commandId, 40, $"Создаю публикацию (webinst): {siteName}{appPath}", ct);
            
            // New publication -> webinst
            await webinst.PublishAsync(version, p.BaseName, p.FolderPath, p.ConnectionString, ct);
            await store.UpdateCommandProgressAsync(commandId, 90, "Проверяю результат...", ct);
        }
    }

    private record PublishNewPayload(string Version, string BaseName, string FolderPath, string ConnectionString);
    private async Task HandlePublishNewAsync(Guid commandId, string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        logger.LogInformation("Deserializing PublishNewPayload from JSON: {Json}", json);
        var p = JsonSerializer.Deserialize<PublishNewPayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");
        
        // Ensure version is not null or empty, and preserve full string
        var version = string.IsNullOrWhiteSpace(p.Version) 
            ? throw new ArgumentException("Версия платформы не указана в команде") 
            : p.Version.Trim();
        
        logger.LogInformation("PublishNewPayload deserialized. Version: '{Version}' (length: {Length})", version, version.Length);

        await store.UpdateCommandProgressAsync(commandId, 20, $"Создаю публикацию (webinst): {p.BaseName}", ct);
        await webinst.PublishAsync(version, p.BaseName, p.FolderPath, p.ConnectionString, ct);
        await store.UpdateCommandProgressAsync(commandId, 90, "Проверяю результат...", ct);
    }

    private record UpdatePublicationVersionPayload(string SiteName, string AppPath, string NewVersionBinPath);
    private async Task HandleUpdatePublicationVersionAsync(Guid commandId, string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        var p = JsonSerializer.Deserialize<UpdatePublicationVersionPayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");

        await store.UpdateCommandProgressAsync(commandId, 40, $"Обновляю версию (IIS): {p.SiteName}{p.AppPath}", ct);
        iis.UpdatePublicationVersion(p.SiteName, p.AppPath, p.NewVersionBinPath);
        await store.UpdateCommandProgressAsync(commandId, 90, "Проверяю результат...", ct);
    }
    
    private record MassUpdatePayload(string SourceVersion, string TargetVersion);
    private async Task HandleMassUpdateVersionsAsync(Guid commandId, string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        logger.LogInformation("Deserializing MassUpdatePayload from JSON: {Json}", json);
        var p = JsonSerializer.Deserialize<MassUpdatePayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");
        
        // Ensure versions are preserved correctly
        var sourceVersion = string.IsNullOrWhiteSpace(p.SourceVersion) ? null : p.SourceVersion.Trim();
        var targetVersion = string.IsNullOrWhiteSpace(p.TargetVersion) 
            ? throw new ArgumentException("Целевая версия платформы не указана") 
            : p.TargetVersion.Trim();
        
        logger.LogInformation("MassUpdatePayload deserialized. SourceVersion: '{Source}' (length: {SourceLen}), TargetVersion: '{Target}' (length: {TargetLen})", 
            sourceVersion, sourceVersion?.Length ?? 0, targetVersion, targetVersion.Length);

        string? sourceBin = null;
        if (!string.IsNullOrEmpty(sourceVersion))
        {
             // If source version is specified, resolve its path
             sourceBin = webinst.GetBinPath(sourceVersion);
        }
        
        var targetBin = webinst.GetBinPath(targetVersion);

        var pubs = iis.GetPublications();

        // First, build the list of publications to update (for stable progress/ETA)
        var targets = new List<(string SiteName, string Path)>();
        foreach (var pub in pubs)
        {
            // Filter logic:
            // 1. If SourceVersion is empty => Update ALL
            // 2. If SourceVersion is set => Update only matching paths
            bool match = string.IsNullOrEmpty(p.SourceVersion) ||
                         (pub.CurrentVersionBinPath != null && sourceBin != null &&
                          pub.CurrentVersionBinPath.Equals(sourceBin, StringComparison.OrdinalIgnoreCase));

            if (match)
            {
                // Skip if already on target version
                if (pub.CurrentVersionBinPath != null && 
                    pub.CurrentVersionBinPath.Equals(targetBin, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                targets.Add((pub.SiteName, pub.Path));
            }
        }

        var total = targets.Count;
        await store.UpdateCommandProgressAsync(
            commandId,
            total == 0 ? 100 : 1,
            total == 0
                ? "Нечего обновлять (все публикации уже на целевой версии)."
                : $"Найдено публикаций для обновления: {total}",
            ct);

        int ok = 0;
        int done = 0;
        var lastProgressWrite = DateTime.UtcNow;

        for (var i = 0; i < targets.Count; i++)
        {
            var t = targets[i];
            try
            {
                iis.UpdatePublicationVersion(t.SiteName, t.Path, targetBin);
                ok++;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to update publication {Path}", t.Path);
                // continue with others
            }

            done++;

            // Throttle DB writes: every 3 items or at least every ~1s
            var now = DateTime.UtcNow;
            if (done == total || done % 3 == 0 || (now - lastProgressWrite).TotalMilliseconds >= 1000)
            {
                var percent = total == 0 ? 100 : (int)Math.Clamp(Math.Round(done * 100.0 / total), 0, 99);
                var msg = $"Обновляю: {done}/{total} • OK: {ok} • {t.SiteName}{t.Path}";
                await store.UpdateCommandProgressAsync(commandId, percent, msg, ct);
                lastProgressWrite = now;
            }
        }

        logger.LogInformation("Mass update completed. Updated {Count} publications.", ok);
        await store.UpdateCommandProgressAsync(commandId, 100, $"Готово. Обновлено: {ok}/{total}", ct);
    }
}
