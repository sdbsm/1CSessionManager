using System.Diagnostics;
using Microsoft.Extensions.Logging;
using SessionManager.Agent.Ports;

namespace SessionManager.Agent.Infrastructure.Services;

public class WebPublicationService(ILogger<WebPublicationService> logger) : IWebPublicationService
{
    public async Task PublishAsync(string version, string baseName, string folderPath, string connectionString, CancellationToken ct)
    {
        var webinstPath = FindWebinstPath(version);
        logger.LogInformation("Using webinst: {Path}", webinstPath);
        
        // Ensure directory exists
        if (!Directory.Exists(folderPath))
        {
            Directory.CreateDirectory(folderPath);
        }

        // Arguments for webinst:
        // -publish -iis -wsdir "baseName" -dir "folderPath" -connstr "connectionString" -confpath "folderPath\default.vrd"
        // Note: webinst requires full path to confpath including filename
        var confPath = Path.Combine(folderPath, "default.vrd");
        
        var args = $"-publish -iis -wsdir \"{baseName}\" -dir \"{folderPath}\" -connstr \"{connectionString}\" -confpath \"{confPath}\"";

        var psi = new ProcessStartInfo
        {
            FileName = webinstPath,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process == null) throw new InvalidOperationException("Failed to start webinst process");

        // We can capture output for logging
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = process.StandardError.ReadToEndAsync(ct);

        await process.WaitForExitAsync(ct);
        
        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            logger.LogError("webinst failed. ExitCode: {Code}. StdErr: {Err}. StdOut: {Out}", process.ExitCode, stderr, stdout);
            throw new Exception($"Ошибка публикации (код {process.ExitCode}): {stderr}");
        }
        
        logger.LogInformation("webinst completed successfully. Output: {Out}", stdout);
    }

    public string GetBinPath(string version)
    {
        var webinst = FindWebinstPath(version); // .../bin/webinst.exe
        return Path.GetDirectoryName(webinst) ?? throw new InvalidOperationException("Invalid webinst path");
    }

    private string FindWebinstPath(string version)
    {
        // Ensure version is not null or empty
        if (string.IsNullOrWhiteSpace(version))
        {
            throw new ArgumentException("Версия платформы не указана", nameof(version));
        }
        
        // Trim to avoid whitespace issues, but preserve the full version string
        version = version.Trim();
        
        logger.LogInformation("Finding webinst.exe for version: '{Version}' (length: {Length})", version, version.Length);
        
        // Standard path: C:\Program Files\1cv8\8.3.xx.xxxx\bin\webinst.exe
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var path = Path.Combine(programFiles, "1cv8", version, "bin", "webinst.exe");
        
        logger.LogInformation("Checking path: {Path}", path);
        
        if (!File.Exists(path))
        {
            // Try Program Files (x86) just in case
            var programFiles86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            var path86 = Path.Combine(programFiles86, "1cv8", version, "bin", "webinst.exe");
            logger.LogInformation("Checking alternative path: {Path}", path86);
            if (File.Exists(path86)) return path86;

            // Provide both paths in error message for debugging
            // Use fileName parameter to ensure full path is preserved in exception
            var errorMsg = $"Платформа {version} не найдена. Проверены пути:\n" +
                          $"1. {path}\n" +
                          $"2. {path86}\n" +
                          $"Убедитесь, что версия платформы указана полностью (например, 8.3.27.1786, а не 8.3.27.178).";
            throw new FileNotFoundException(errorMsg, path);
        }
            
        return path;
    }

    public List<string> GetInstalledVersions()
    {
        var result = new List<string>();
        // Scan C:\Program Files\1cv8\*
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        ScanOneCFolder(Path.Combine(programFiles, "1cv8"), result);
        
        var programFiles86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        ScanOneCFolder(Path.Combine(programFiles86, "1cv8"), result);

        return result.Distinct().OrderByDescending(x => x).ToList();
    }

    private void ScanOneCFolder(string path, List<string> result)
    {
        if (!Directory.Exists(path)) return;
        
        foreach (var dir in Directory.GetDirectories(path))
        {
            var name = Path.GetFileName(dir);
            // Check if it looks like a version (e.g. 8.3.24.1342)
            // Simple heuristic: starts with 8.
            if (name.StartsWith("8."))
            {
                // Check if bin/webinst.exe or bin/rac.exe exists inside
                if (File.Exists(Path.Combine(dir, "bin", "webinst.exe")))
                {
                    result.Add(name);
                }
            }
        }
    }
}
