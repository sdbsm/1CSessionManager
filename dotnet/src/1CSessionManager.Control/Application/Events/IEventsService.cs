namespace SessionManager.Control.Application.Events;

public interface IEventsService
{
    Task<IReadOnlyList<SystemEventDto>> ListAsync(ListEventsRequest req, CancellationToken ct);
    Task ClearAsync(CancellationToken ct);
}
