using System.Diagnostics;
using System.Text;

namespace SessionManager.Shared.OneC.Rac;

/// <summary>
/// Thin wrapper for running 1C RAC (rac.exe) commands on Windows.
/// Output encoding is CP866 (typical for RAC on RU Windows).
/// </summary>
public sealed class RacClient
{
    private readonly TimeSpan _timeout;
    private readonly Encoding _encoding;

    public RacClient(TimeSpan timeout)
    {
        _timeout = timeout;
        _encoding = Encoding.GetEncoding(866); // cp866
    }

    public async Task<string?> RunAsync(
        string racPath,
        string rasHost,
        IReadOnlyList<string> args,
        CancellationToken ct)
    {
        racPath = racPath.Trim().Trim('"');

        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("RAC runner is Windows-oriented.");

        if (!File.Exists(racPath))
            throw new FileNotFoundException("rac.exe not found", racPath);

        var psi = new ProcessStartInfo
        {
            FileName = racPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = _encoding,
            StandardErrorEncoding = _encoding
        };

        foreach (var a in args)
            psi.ArgumentList.Add(a);

        psi.ArgumentList.Add(rasHost.Trim());

        using var proc = new Process { StartInfo = psi };
        proc.Start();

        var stdoutTask = proc.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = proc.StandardError.ReadToEndAsync(ct);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(_timeout);

        try
        {
            await proc.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            try { proc.Kill(entireProcessTree: true); } catch { /* ignore */ }
            throw new TimeoutException($"RAC command timed out after {_timeout.TotalSeconds:0}s.");
        }

        var stdout = await stdoutTask;
        _ = await stderrTask; // RAC can write warnings to stderr with ExitCode=0

        if (proc.ExitCode != 0)
            return null;

        return stdout;
    }
}
