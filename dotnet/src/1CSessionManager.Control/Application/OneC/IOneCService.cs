namespace SessionManager.Control.Application.OneC;

public interface IOneCService
{
    Task<LegacySettingsDto?> GetLegacySettingsAsync(CancellationToken ct);
    Task<LegacySettingsDto> UpdateLegacySettingsAsync(LegacySettingsUpdateRequest req, CancellationToken ct);

    Task<TestConnectionResponse> TestConnectionAsync(TestConnectionRequest req, CancellationToken ct);

    ServerInfoDto GetServerInfo();

    Task<IReadOnlyList<InfobaseDto>> GetInfobasesAsync(CancellationToken ct);
}
