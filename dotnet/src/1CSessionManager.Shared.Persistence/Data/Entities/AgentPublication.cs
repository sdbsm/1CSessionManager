using System.ComponentModel.DataAnnotations;

namespace SessionManager.Shared.Data.Entities;

public class AgentPublication
{
    public Guid Id { get; set; }
    
    public Guid AgentId { get; set; }
    public AgentInstance? Agent { get; set; }
    
    [MaxLength(128)]
    public string SiteName { get; set; } = null!;
    
    [MaxLength(256)]
    public string AppPath { get; set; } = null!; // "/buh"
    
    [MaxLength(512)]
    public string PhysicalPath { get; set; } = null!;
    
    [MaxLength(64)]
    public string? Version { get; set; } // "8.3.24.1342"
    
    public DateTime LastDetectedAtUtc { get; set; }
}
