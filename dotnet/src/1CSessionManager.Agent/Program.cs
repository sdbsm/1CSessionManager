using SessionManager.Agent;
using SessionManager.Agent.Monitoring;
using SessionManager.Agent.Persistence;
using SessionManager.Agent.Services;
using SessionManager.Agent.Infrastructure.Services;
using SessionManager.Agent.Ports;
using System.Text;
using Microsoft.Extensions.Hosting.WindowsServices;
using SessionManager.Shared.Configuration;
using SessionManager.Shared.Security;
using SessionManager.Shared.OneC.Rac;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);

// Configure Serilog
builder.Services.AddSerilog((services, lc) =>
{
    lc.ReadFrom.Configuration(builder.Configuration);
    lc.Enrich.FromLogContext();
    lc.Enrich.WithProperty("Service", "Agent");
    lc.Enrich.WithProperty("Environment", builder.Environment.EnvironmentName);

    lc.WriteTo.Console();
    var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs", "agent-.log");
    lc.WriteTo.File(logPath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7);
});

// Enable CP866 decoding for RAC output on Windows
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

// Windows Service hosting (safe to call even when running as console)
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "1C Session Manager Agent";
});

builder.Services.AddSqlServerAppDb(builder.Configuration);

builder.Services.AddSingleton<SecretProtector>();
builder.Services.AddSingleton(_ => new RacClient(timeout: TimeSpan.FromSeconds(30)));

builder.Services.AddSingleton<IAgentIdentityProvider, AgentIdentityProvider>();
builder.Services.AddSingleton<ISystemMetricsCollector, SystemMetricsCollector>();
builder.Services.AddSingleton<IRacSessionClient, RacSessionClient>();
builder.Services.AddSingleton<IAgentDataStore, AgentDataStore>();
builder.Services.AddSingleton<IIisManagementService, IisManagementService>();
builder.Services.AddSingleton<IWebPublicationService, WebPublicationService>();
builder.Services.AddSingleton<AgentCommandProcessor>();
builder.Services.AddSingleton<SessionEnforcer>();
builder.Services.AddSingleton<AgentMonitorLoop>();

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
