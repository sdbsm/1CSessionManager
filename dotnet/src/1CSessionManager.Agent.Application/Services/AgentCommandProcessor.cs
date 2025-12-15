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

                switch (cmd.CommandType)
                {
                    case "PublishNew":
                        await HandlePublishNewAsync(cmd.PayloadJson, ct);
                        break;
                    case "Publish":
                        await HandlePublishAsync(cmd.PayloadJson, ct);
                        break;
                    case "UpdatePublicationVersion":
                        await HandleUpdatePublicationVersionAsync(cmd.PayloadJson, ct);
                        break;
                    case "MassUpdateVersions":
                        await HandleMassUpdateVersionsAsync(cmd.PayloadJson, ct);
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
                await store.UpdateCommandStatusAsync(cmd.Id, "Failed", ex.Message, ct);
            }
        }
    }

    private record PublishPayload(string Version, string BaseName, string FolderPath, string ConnectionString, string? SiteName);
    private async Task HandlePublishAsync(string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        var p = JsonSerializer.Deserialize<PublishPayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");

        var siteName = p.SiteName ?? "Default Web Site";
        var appPath = p.BaseName.StartsWith("/") ? p.BaseName : "/" + p.BaseName;

        // Check if exists
        var pubs = iis.GetPublications();
        var existing = pubs.FirstOrDefault(x => 
            x.SiteName.Equals(siteName, StringComparison.OrdinalIgnoreCase) && 
            x.Path.Equals(appPath, StringComparison.OrdinalIgnoreCase));

        if (existing != null)
        {
            logger.LogInformation("Publication {Path} exists. Updating version to {Version}...", appPath, p.Version);
            
            // It exists. Update version safely using IIS API.
            // 1. Resolve bin path for target version
            var binPath = webinst.GetBinPath(p.Version);
            
            // 2. Update IIS
            iis.UpdatePublicationVersion(siteName, appPath, binPath);
        }
        else
        {
            logger.LogInformation("Publication {Path} does not exist. Creating new via webinst...", appPath);
            
            // New publication -> webinst
            await webinst.PublishAsync(p.Version, p.BaseName, p.FolderPath, p.ConnectionString, ct);
        }
    }

    private record PublishNewPayload(string Version, string BaseName, string FolderPath, string ConnectionString);
    private async Task HandlePublishNewAsync(string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        var p = JsonSerializer.Deserialize<PublishNewPayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");

        await webinst.PublishAsync(p.Version, p.BaseName, p.FolderPath, p.ConnectionString, ct);
    }

    private record UpdatePublicationVersionPayload(string SiteName, string AppPath, string NewVersionBinPath);
    private Task HandleUpdatePublicationVersionAsync(string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        var p = JsonSerializer.Deserialize<UpdatePublicationVersionPayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");

        iis.UpdatePublicationVersion(p.SiteName, p.AppPath, p.NewVersionBinPath);
        return Task.CompletedTask;
    }
    
    private record MassUpdatePayload(string SourceVersion, string TargetVersion);
    private async Task HandleMassUpdateVersionsAsync(string? json, CancellationToken ct)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));
        var p = JsonSerializer.Deserialize<MassUpdatePayload>(json);
        if (p == null) throw new ArgumentException("Invalid payload");

        string? sourceBin = null;
        if (!string.IsNullOrEmpty(p.SourceVersion))
        {
             // If source version is specified, resolve its path
             sourceBin = webinst.GetBinPath(p.SourceVersion);
        }
        
        var targetBin = webinst.GetBinPath(p.TargetVersion);

        var pubs = iis.GetPublications();
        int count = 0;
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

                try 
                {
                    iis.UpdatePublicationVersion(pub.SiteName, pub.Path, targetBin);
                    count++;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to update publication {Path}", pub.Path);
                    // continue with others
                }
            }
        }
        
        logger.LogInformation("Mass update completed. Updated {Count} publications.", count);
        return; // Fixed: remove Task.CompletedTask since method is async Task
    }
}
