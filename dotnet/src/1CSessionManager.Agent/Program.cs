using SessionManager.Agent;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting.WindowsServices;
using SessionManager.Shared.Configuration;
using SessionManager.Shared.Data;
using SessionManager.Shared.Security;

var builder = Host.CreateApplicationBuilder(args);

// Enable CP866 decoding for RAC output on Windows
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

// Windows Service hosting (safe to call even when running as console)
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "1C Session Manager Agent";
});

builder.Services.Configure<SqlLoginConnectionOptions>(builder.Configuration.GetSection("Database:Sql"));
builder.Services.AddSingleton<WindowsCredentialStore>();
builder.Services.AddSingleton<SqlDbEndpointSecretStore>();
builder.Services.AddSingleton<SqlLoginSecretStore>();
builder.Services.AddSingleton<SqlLoginConnectionStringProvider>();
builder.Services.AddSingleton<IDbContextFactory<AppDbContext>, DynamicDbContextFactory>();

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
