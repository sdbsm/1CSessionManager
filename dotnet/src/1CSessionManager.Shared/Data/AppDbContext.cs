using Microsoft.EntityFrameworkCore;
using SessionManager.Shared.Data.Entities;

namespace SessionManager.Shared.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AgentInstance> Agents => Set<AgentInstance>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientDatabase> ClientDatabases => Set<ClientDatabase>();
    public DbSet<SystemEvent> Events => Set<SystemEvent>();
    public DbSet<AgentMetricBucket> AgentMetricBuckets => Set<AgentMetricBucket>();
    public DbSet<ClientMetricBucket> ClientMetricBuckets => Set<ClientMetricBucket>();
    public DbSet<AppSecret> AppSecrets => Set<AppSecret>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Agent
        modelBuilder.Entity<AgentInstance>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(128);
            e.Property(x => x.Hostname).HasMaxLength(128);
            e.Property(x => x.RacPath).HasMaxLength(512);
            e.Property(x => x.RasHost).HasMaxLength(256);
            e.Property(x => x.ClusterUser).HasMaxLength(128);
            e.Property(x => x.ClusterPassProtected).HasMaxLength(2048);

            e.HasIndex(x => x.Hostname);
        });

        // Client
        modelBuilder.Entity<Client>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(256);
            e.HasIndex(x => new { x.AgentId, x.Name }).IsUnique();

            e.HasOne(x => x.Agent)
                .WithMany()
                .HasForeignKey(x => x.AgentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ClientDatabase
        modelBuilder.Entity<ClientDatabase>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.InfobaseUuid).HasMaxLength(64);

            // На одном агенте имя БД уникально (не может быть привязано к двум клиентам)
            e.HasIndex(x => new { x.AgentId, x.Name }).IsUnique();
            e.HasIndex(x => x.ClientId);

            e.HasOne(x => x.Agent)
                .WithMany()
                .HasForeignKey(x => x.AgentId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.Client)
                .WithMany(x => x.Databases)
                .HasForeignKey(x => x.ClientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // SystemEvent
        modelBuilder.Entity<SystemEvent>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Message).HasMaxLength(4000);
            e.Property(x => x.ClientName).HasMaxLength(256);
            e.Property(x => x.DatabaseName).HasMaxLength(256);
            e.Property(x => x.SessionId).HasMaxLength(128);
            e.Property(x => x.UserName).HasMaxLength(256);

            e.HasIndex(x => new { x.AgentId, x.TimestampUtc });
            e.HasIndex(x => x.Level);

            e.HasOne(x => x.Agent)
                .WithMany()
                .HasForeignKey(x => x.AgentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // AgentMetricBucket
        modelBuilder.Entity<AgentMetricBucket>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.AgentId, x.BucketStartUtc }).IsUnique();
            e.HasOne(x => x.Agent)
                .WithMany()
                .HasForeignKey(x => x.AgentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ClientMetricBucket
        modelBuilder.Entity<ClientMetricBucket>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.AgentId, x.BucketStartUtc, x.ClientId }).IsUnique();
            e.HasOne(x => x.Agent)
                .WithMany()
                .HasForeignKey(x => x.AgentId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Client)
                .WithMany()
                .HasForeignKey(x => x.ClientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AppSecret
        modelBuilder.Entity<AppSecret>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(128);
            e.Property(x => x.ProtectedValueBase64).HasMaxLength(4096);
            e.HasIndex(x => x.UpdatedAtUtc);
        });
    }
}


