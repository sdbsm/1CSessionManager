using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;

namespace _1CSessionManager.Installer;

internal class Program
{
    private const string DefaultInstallDir = @"C:\Program Files\1CSessionManager";
    private const string ServiceControlName = "1C Session Manager Control";
    private const string ServiceAgentName = "1C Session Manager Agent";

    // A simple file logger helper
    static void Log(string message)
    {
        Console.WriteLine(message);
        try
        {
            var logFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "install.log");
            File.AppendAllText(logFile, $"[{DateTime.Now}] {message}{Environment.NewLine}");
        }
        catch { /* ignore logging errors */ }
    }

    static void Main(string[] args)
    {
        try
        {
            Log("=== 1C Session Manager Installer ===");
            
            if (!IsAdministrator())
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Log("Error: This installer must be run as Administrator.");
                Console.ResetColor();
                Pause();
                return;
            }

            var installDir = GetInstallDir(args) ?? DefaultInstallDir;

            bool isUninstall = args.Any(a => a.Equals("--uninstall", StringComparison.OrdinalIgnoreCase) || a.Equals("/uninstall", StringComparison.OrdinalIgnoreCase));
            bool isInstall = args.Any(a => a.Equals("--install", StringComparison.OrdinalIgnoreCase) || a.Equals("/install", StringComparison.OrdinalIgnoreCase));
            bool noStart = args.Any(a => a.Equals("--no-start", StringComparison.OrdinalIgnoreCase));

            if (isUninstall)
            {
                RunUninstall(installDir);
            }
            else if (isInstall)
            {
                RunInstall(installDir, noStart);
            }
            else
            {
                // Interactive Mode
                Log("Select an action:");
                Log("1. Install");
                Log("2. Uninstall");
                Log("3. Exit");
                Console.Write("Enter choice (1-3): ");
                
                var key = Console.ReadKey();
                Console.WriteLine();

                switch (key.KeyChar)
                {
                    case '1':
                        RunInstall(installDir, noStart: false);
                        break;
                    case '2':
                        RunUninstall(installDir);
                        break;
                    default:
                        Log("Exiting.");
                        break;
                }
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Log($"An error occurred: {ex.Message}");
            Log(ex.StackTrace ?? "");
            Console.ResetColor();
        }
        finally
        {
            Pause();
        }
    }

    static void RunInstall(string installDir, bool noStart)
    {
        Log($"\nStarting Installation to: {installDir}");

        // 1. Prepare Directory
        EnsureDirectory(installDir);

        // 2. Stop services if running (to allow overwriting files)
        StopService(ServiceControlName);
        StopService(ServiceAgentName);

        // 2.1 Preserve user configs across upgrades (do not overwrite appsettings.json)
        var backups = BackupConfigs(installDir);

        // 3. Extract Files
        Log("Extracting embedded files...");
        ExtractPayload(installDir);

        // 3.1 Restore configs if they existed (upgrade-safe)
        RestoreConfigs(installDir, backups);

        // 4. Install Services
        var controlExe = Path.Combine(installDir, "control", "1CSessionManager.Control.exe");
        var agentExe = Path.Combine(installDir, "agent", "1CSessionManager.Agent.exe");

        if (!File.Exists(controlExe)) throw new FileNotFoundException($"Extracted file not found: {controlExe}");
        if (!File.Exists(agentExe)) throw new FileNotFoundException($"Extracted file not found: {agentExe}");

        InstallService(ServiceControlName, "1C Session Manager Control API (ASP.NET Core)", controlExe);
        InstallService(ServiceAgentName, "1C Session Manager Agent (RAC monitoring)", agentExe);

        // 5. Start Services
        if (!noStart)
        {
            StartService(ServiceControlName);
            StartService(ServiceAgentName);
        }

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Green;
        Log("Installation completed successfully!");
        Console.ResetColor();
        
        Log("Please configure appsettings.json in:");
        Log($"  {Path.Combine(installDir, "control", "appsettings.json")}");
        Log($"  {Path.Combine(installDir, "agent", "appsettings.json")}");
    }

    static void RunUninstall(string installDir)
    {
        Log($"\nStarting Uninstallation...");

        // 1. Stop Services
        StopService(ServiceControlName);
        StopService(ServiceAgentName);

        // 2. Delete Services
        DeleteService(ServiceControlName);
        DeleteService(ServiceAgentName);

        // 3. Delete Files
        if (Directory.Exists(installDir))
        {
            Log($"Removing directory: {installDir}");
            try 
            {
                // Check if we are running from inside the install dir
                var currentProcess = Process.GetCurrentProcess().MainModule?.FileName;
                if (currentProcess != null && currentProcess.StartsWith(installDir, StringComparison.OrdinalIgnoreCase))
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Log("Warning: The installer is running from inside the installation directory.");
                    Log("Cannot delete the directory completely. Please delete the remaining files manually after exit.");
                    Console.ResetColor();
                }
                else
                {
                    Directory.Delete(installDir, true);
                    Log("Directory removed.");
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Log($"Could not fully remove directory: {ex.Message}");
                Log("You may need to delete it manually.");
                Console.ResetColor();
            }
        }
        else
        {
            Log("Directory already does not exist.");
        }

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Green;
        Log("Uninstallation completed.");
        Console.ResetColor();
    }


    static bool IsAdministrator()
    {
        var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
        var principal = new System.Security.Principal.WindowsPrincipal(identity);
        return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
    }

    static void Pause()
    {
        Log("\nPress any key to exit...");
        Console.ReadKey();
    }

    static void EnsureDirectory(string path)
    {
        if (!Directory.Exists(path))
        {
            Directory.CreateDirectory(path);
            Log($"Created directory: {path}");
        }
    }

    static void ExtractPayload(string destinationDir)
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("payload.zip");
        if (stream == null)
        {
            throw new InvalidOperationException("Embedded resource 'payload.zip' not found in installer.");
        }

        var tempZip = Path.GetTempFileName();
        try
        {
            using (var fileStream = File.Create(tempZip))
            {
                stream.CopyTo(fileStream);
            }

            Log($"Extracting to {destinationDir}...");
            ZipFile.ExtractToDirectory(tempZip, destinationDir, overwriteFiles: true);
        }
        finally
        {
            if (File.Exists(tempZip))
            {
                try { File.Delete(tempZip); } catch { }
            }
        }
    }

    static void RunSc(string args)
    {
        var psi = new ProcessStartInfo("sc.exe", args)
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        using var p = Process.Start(psi);
        if (p is null)
        {
            Log($"Failed to start sc.exe for args: {args}");
            return;
        }

        var stdout = p.StandardOutput.ReadToEnd();
        var stderr = p.StandardError.ReadToEnd();
        p.WaitForExit();

        if (!string.IsNullOrWhiteSpace(stdout))
            Log(stdout.Trim());
        if (!string.IsNullOrWhiteSpace(stderr))
            Log(stderr.Trim());

        if (p.ExitCode != 0 && p.ExitCode != 1060 && p.ExitCode != 1062 && p.ExitCode != 1073) // 1060=service not exists, 1062=not started, 1073=already exists
        {
             // We don't want to fail hard if service doesn't exist during stop, but we want to log if create fails
             Log($"Command 'sc {args}' exited with code {p.ExitCode}");
        }
    }

    static bool ServiceExists(string serviceName)
    {
        var psi = new ProcessStartInfo("sc.exe", $"query \"{serviceName}\"")
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        using var p = Process.Start(psi);
        if (p is null) return false;
        p.WaitForExit();
        return p.ExitCode == 0;
    }

    static string? QueryServiceState(string serviceName)
    {
        var psi = new ProcessStartInfo("sc.exe", $"query \"{serviceName}\"")
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        using var p = Process.Start(psi);
        if (p is null) return null;
        var text = p.StandardOutput.ReadToEnd();
        p.WaitForExit();
        if (string.IsNullOrWhiteSpace(text)) return null;
        // sc.exe output is localized (e.g. "STATE" vs "Состояние"). Parse both variants.
        var m = System.Text.RegularExpressions.Regex.Match(
            text,
            @"(?:STATE|Состояние)\s*:\s*\d+\s+(\w+)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value.ToUpperInvariant() : null;
    }

    static void WaitServiceState(string serviceName, string desiredState, int timeoutSeconds = 30)
    {
        var desired = desiredState.ToUpperInvariant();
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);
        while (DateTime.UtcNow < deadline)
        {
            var state = QueryServiceState(serviceName);
            if (state == desired) return;
            Thread.Sleep(500);
        }
    }

    static void StopService(string serviceName)
    {
        if (!ServiceExists(serviceName)) return;
        var state = QueryServiceState(serviceName);
        if (state == "STOPPED") return;

        Log($"Stopping service: {serviceName}...");
        RunSc($"stop \"{serviceName}\"");
        WaitServiceState(serviceName, "STOPPED", timeoutSeconds: 30);
    }

    static void StartService(string serviceName)
    {
        Log($"Starting service: {serviceName}...");
        RunSc($"start \"{serviceName}\"");

        // sc.exe may return START_PENDING; wait for RUNNING to improve UX/diagnostics.
        WaitServiceState(serviceName, "RUNNING", timeoutSeconds: 60);
        var state = QueryServiceState(serviceName) ?? "UNKNOWN";
        if (state != "RUNNING")
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Log($"Warning: service '{serviceName}' state after start: {state}");
            Console.ResetColor();
        }
    }

    static void DeleteService(string serviceName)
    {
        Log($"Deleting service: {serviceName}...");
        RunSc($"delete \"{serviceName}\"");
    }

    static void InstallService(string serviceName, string displayName, string binPath)
    {
        Log($"Configuring service: {serviceName}...");
        
        // Note: sc create binPath requires escaped quotes if path has spaces
        // But Process.Start with argument string handles arguments differently.
        // We are constructing the whole argument string ourselves.
        // The format should be: binPath= "C:\Path With Spaces\file.exe"
        // So we need to wrap the path in quotes.
        
        string binPathEscaped = $"\"{binPath}\"";
        
        if (!ServiceExists(serviceName))
        {
            // Create
            RunSc($"create \"{serviceName}\" binPath= {binPathEscaped} start= auto");
        }
        else
        {
            // Ensure binPath/start mode updated on upgrade
            RunSc($"config \"{serviceName}\" binPath= {binPathEscaped} start= auto");
        }
        
        // Update description
        RunSc($"description \"{serviceName}\" \"{displayName}\"");
        
        // Set recovery
        RunSc($"failure \"{serviceName}\" reset= 86400 actions= restart/5000/restart/5000/restart/5000");
    }

    static string? GetInstallDir(string[] args)
    {
        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            if (a.StartsWith("--dir=", StringComparison.OrdinalIgnoreCase))
                return a.Substring("--dir=".Length).Trim().Trim('"');
            if (a.Equals("--dir", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                return args[i + 1].Trim().Trim('"');
        }
        return null;
    }

    static Dictionary<string, string> BackupConfigs(string installDir)
    {
        var backups = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rel in new[] { "control", "agent" })
        {
            var dir = Path.Combine(installDir, rel);
            if (!Directory.Exists(dir)) continue;

            foreach (var file in Directory.EnumerateFiles(dir, "appsettings*.json", SearchOption.TopDirectoryOnly))
            {
                try
                {
                    var name = Path.GetFileName(file);
                    backups[$"{rel}\\{name}"] = File.ReadAllText(file);
                }
                catch (Exception ex)
                {
                    Log($"Warning: failed to backup {file}: {ex.Message}");
                }
            }
        }
        return backups;
    }

    static void RestoreConfigs(string installDir, Dictionary<string, string> backups)
    {
        foreach (var kv in backups)
        {
            try
            {
                var target = Path.Combine(installDir, kv.Key);
                var dir = Path.GetDirectoryName(target);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(target, kv.Value);
            }
            catch (Exception ex)
            {
                Log($"Warning: failed to restore {kv.Key}: {ex.Message}");
            }
        }
    }
}
