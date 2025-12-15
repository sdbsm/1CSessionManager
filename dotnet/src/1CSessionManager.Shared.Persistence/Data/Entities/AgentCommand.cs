using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SessionManager.Shared.Data.Entities;

public sealed class AgentCommand
{
    public Guid Id { get; set; }
    
    public Guid AgentId { get; set; }
    
    [Required]
    public string CommandType { get; set; } = null!; // "Publish", "UpdateVersion", "SetPlatform"
    
    public string? PayloadJson { get; set; }
    
    [Required]
    public string Status { get; set; } = "Pending"; // "Pending", "Processing", "Completed", "Failed"
    
    public string? ErrorMessage { get; set; }

    // Progress (optional; used for long-running agent operations)
    public int? ProgressPercent { get; set; } // 0..100
    public string? ProgressMessage { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? LastUpdatedAtUtc { get; set; }
    
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ProcessedAtUtc { get; set; }
}
