namespace SessionManager.Agent.Ports;

public interface IWebPublicationService
{
    Task PublishAsync(string version, string baseName, string folderPath, string connectionString, CancellationToken ct);
    string GetBinPath(string version);
    List<string> GetInstalledVersions();
}
