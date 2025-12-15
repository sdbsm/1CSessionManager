using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Web.Administration;
using SessionManager.Agent.Ports;

namespace SessionManager.Agent.Infrastructure.Services;

public class IisManagementService(ILogger<IisManagementService> logger) : IIisManagementService
{
    public List<OneCPublication> GetPublications()
    {
        var result = new List<OneCPublication>();

        // ServerManager is IDisposable, but in some contexts you might want to keep it.
        // For a short lived task, using is fine.
        // Requires Admin privileges.
        try
        {
            using var serverManager = new ServerManager();

            foreach (var site in serverManager.Sites)
            {
                foreach (var app in site.Applications)
                {
                    // Check if this application has 1C handler
                    // This is a heuristic. We look for wsisapi.dll in handler mappings.
                    
                    // Note: accessing config for every app might be slow, but ok for typical server.
                    try
                    {
                        var config = app.GetWebConfiguration();
                        var handlersSection = config.GetSection("system.webServer/handlers");
                        var handlers = handlersSection.GetCollection();

                        string? binPath = null;
                        foreach (var handler in handlers)
                        {
                            var scriptProcessor = (string)handler["scriptProcessor"];
                            if (!string.IsNullOrEmpty(scriptProcessor) && 
                                scriptProcessor.EndsWith("wsisapi.dll", StringComparison.OrdinalIgnoreCase))
                            {
                                binPath = scriptProcessor;
                                break;
                            }
                        }

                        if (binPath != null)
                        {
                            // It's a 1C publication
                            // app.Path is typically "/appname"
                            var vdir = app.VirtualDirectories["/"];
                            var physPath = vdir?.PhysicalPath;

                            result.Add(new OneCPublication(
                                SiteName: site.Name,
                                Path: app.Path,
                                PhysicalPath: physPath ?? "",
                                CurrentVersionBinPath: Path.GetDirectoryName(binPath)
                            ));
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Failed to inspect application {Path} on site {Site}", app.Path, site.Name);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to query IIS");
        }

        return result;
    }

    public void UpdatePublicationVersion(string siteName, string appPath, string newVersionBinPath)
    {
        using var serverManager = new ServerManager();
        var site = serverManager.Sites[siteName];
        if (site == null) throw new ArgumentException($"Site {siteName} not found");

        var app = site.Applications[appPath];
        if (app == null) throw new ArgumentException($"Application {appPath} not found");

        var config = app.GetWebConfiguration();
        var handlersSection = config.GetSection("system.webServer/handlers");
        var handlers = handlersSection.GetCollection();

        bool found = false;
        foreach (var handler in handlers)
        {
            var scriptProcessor = (string)handler["scriptProcessor"];
            if (!string.IsNullOrEmpty(scriptProcessor) && 
                scriptProcessor.EndsWith("wsisapi.dll", StringComparison.OrdinalIgnoreCase))
            {
                var newDllPath = Path.Combine(newVersionBinPath, "wsisapi.dll");
                if (!File.Exists(newDllPath))
                {
                    throw new FileNotFoundException($"New wsisapi.dll not found at {newDllPath}");
                }

                handler["scriptProcessor"] = $"\"{newDllPath}\""; // Quotes are important if path has spaces
                found = true;
            }
        }

        if (found)
        {
            serverManager.CommitChanges();
            
            // Recycle AppPool
            var appPoolName = app.ApplicationPoolName;
            if (!string.IsNullOrEmpty(appPoolName))
            {
                var pool = serverManager.ApplicationPools[appPoolName];
                if (pool != null && pool.State == ObjectState.Started)
                {
                    pool.Recycle();
                    logger.LogInformation("Recycled AppPool {Pool} for {App}", appPoolName, appPath);
                }
            }
        }
        else
        {
            logger.LogWarning("No 1C handler found for {App} to update", appPath);
        }
    }
}
