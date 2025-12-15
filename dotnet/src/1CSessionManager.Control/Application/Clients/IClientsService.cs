namespace SessionManager.Control.Application.Clients;

public interface IClientsService
{
    Task<IReadOnlyList<ClientDto>> ListAsync(CancellationToken ct);
    Task<ClientDto> CreateAsync(CreateClientRequest req, CancellationToken ct);
    Task<ClientDto?> UpdateAsync(Guid clientId, UpdateClientRequest req, CancellationToken ct);
    Task<bool> DeleteAsync(Guid clientId, CancellationToken ct);
}
