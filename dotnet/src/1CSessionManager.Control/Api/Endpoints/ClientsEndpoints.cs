using SessionManager.Control.Application.Clients;

namespace SessionManager.Control.Api.Endpoints;

public static class ClientsEndpoints
{
    public static IEndpointRouteBuilder MapClientsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/clients", async (IClientsService clients, CancellationToken ct) =>
        {
            var items = await clients.ListAsync(ct);
            return Results.Ok(items);
        });

        endpoints.MapPost("/api/clients", async (CreateClientRequest req, IClientsService clients, CancellationToken ct) =>
        {
            try
            {
                var created = await clients.CreateAsync(req, ct);
                return Results.Ok(created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        endpoints.MapPut("/api/clients/{id}", async (string id, UpdateClientRequest req, IClientsService clients, CancellationToken ct) =>
        {
            if (!Guid.TryParse(id, out var clientId))
                return Results.BadRequest(new { error = "Invalid client id" });

            var updated = await clients.UpdateAsync(clientId, req, ct);
            if (updated is null) return Results.NotFound();
            return Results.Ok(updated);
        });

        endpoints.MapDelete("/api/clients/{id}", async (string id, IClientsService clients, CancellationToken ct) =>
        {
            if (!Guid.TryParse(id, out var clientId))
                return Results.BadRequest(new { error = "Invalid client id" });

            var ok = await clients.DeleteAsync(clientId, ct);
            if (!ok) return Results.NotFound();
            return Results.Ok(new { success = true });
        });

        return endpoints;
    }

}
