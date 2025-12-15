namespace SessionManager.Agent.Ports;

public record OneCPublication(
    string SiteName, 
    string Path, 
    string PhysicalPath, 
    string? CurrentVersionBinPath
);

public interface IIisManagementService
{
    List<OneCPublication> GetPublications();
    void UpdatePublicationVersion(string siteName, string appPath, string newVersionBinPath);
}
