using System.Diagnostics;
using System.Text;

namespace SessionManager.Agent.Services.Rac;

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
        var stderr = await stderrTask;

        if (proc.ExitCode != 0)
            return null;

        // stderr иногда содержит предупреждения, но при ExitCode=0 считаем успехом
        return stdout;
    }
}


