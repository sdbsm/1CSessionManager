using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SessionManager.Agent.Ports;

namespace SessionManager.Agent.Monitoring;

public sealed class SystemMetricsCollector : ISystemMetricsCollector, IDisposable
{
    private readonly ILogger<SystemMetricsCollector> _logger;
    private PerformanceCounter? _cpuCounter;
    private PerformanceCounter? _ramAvailableCounter;

    public SystemMetricsCollector(ILogger<SystemMetricsCollector> logger)
    {
        _logger = logger;

        if (!OperatingSystem.IsWindows())
            return;

        try
        {
            _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
            _ramAvailableCounter = new PerformanceCounter("Memory", "Available MBytes");
            _cpuCounter.NextValue(); // first read is 0
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to init PerformanceCounters: {Error}", ex.Message);
        }
    }

    public SystemMetricsSnapshot Collect()
    {
        short cpu = 0;
        int memUsed = 0;
        int memTotal = 0;
        string? diskJson = null;

        if (_cpuCounter is not null && _ramAvailableCounter is not null)
        {
            try
            {
                cpu = (short)_cpuCounter.NextValue();

                var availableMb = (int)_ramAvailableCounter.NextValue();
                var totalMb = (int)(GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024 / 1024);

                memTotal = totalMb;
                memUsed = Math.Max(0, totalMb - availableMb);
            }
            catch
            {
                // ignore counter errors
            }
        }

        try
        {
            var drives = DriveInfo.GetDrives()
                .Where(d => d.DriveType == DriveType.Fixed && d.IsReady)
                .Select(d => new
                {
                    Name = d.Name,
                    TotalGB = (long)(d.TotalSize / 1024 / 1024 / 1024),
                    FreeGB = (long)(d.AvailableFreeSpace / 1024 / 1024 / 1024)
                })
                .ToArray();

            if (drives.Length > 0)
                diskJson = JsonSerializer.Serialize(drives);
        }
        catch
        {
            // ignore disk access errors
        }

        return new SystemMetricsSnapshot(cpu, memUsed, memTotal, diskJson);
    }

    public void Dispose()
    {
        _cpuCounter?.Dispose();
        _ramAvailableCounter?.Dispose();
    }
}

