using SessionManager.Control.Application.Events;

namespace SessionManager.Control.Api.Endpoints;

public static class EventsEndpoints
{
    public static IEndpointRouteBuilder MapEventsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/events", async (
            Guid? agentId,
            DateTime? fromUtc,
            DateTime? toUtc,
            string? levels,
            string? q,
            string? clientId,
            string? database,
            string? user,
            int? take,
            IEventsService events,
            CancellationToken ct) =>
        {
            var items = await events.ListAsync(new ListEventsRequest(
                AgentId: agentId,
                FromUtc: fromUtc,
                ToUtc: toUtc,
                Levels: levels,
                Q: q,
                ClientId: clientId,
                Database: database,
                User: user,
                Take: take
            ), ct);

            return Results.Ok(items);
        });

        endpoints.MapDelete("/api/events", async (IEventsService events, CancellationToken ct) =>
        {
            await events.ClearAsync(ct);
            return Results.Ok(new { success = true, message = "Events cleared" });
        });

        return endpoints;
    }
}
