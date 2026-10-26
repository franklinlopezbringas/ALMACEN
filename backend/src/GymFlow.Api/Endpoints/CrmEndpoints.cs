using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class CrmEndpoints
{
    public static IEndpointRouteBuilder MapCrmEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/prospects").WithTags("CRM").RequireAuthorization();
        group.MapGet("/", (string? search, string? status, int? page, int? pageSize, ICrmService service, CancellationToken ct) =>
            service.SearchAsync(search, status, page ?? 1, pageSize ?? 25, ct))
            .RequirePermission("PROSPECTS.VIEW");
        group.MapPost("/", async (CreateProspectRequest request, HttpContext http, ICrmService service, CancellationToken ct) =>
        {
            var id = await service.CreateAsync(request, http.User.RequireUserId(), ct);
            return Results.Created($"/api/v1/prospects/{id}", new { prospectId = id });
        }).RequirePermission("PROSPECTS.MANAGE");
        group.MapPost("/{prospectId:long}/convert", async (long prospectId, ConvertProspectRequest request, HttpContext http, ICrmService service, CancellationToken ct) =>
            Results.Ok(await service.ConvertAsync(prospectId, request, http.User.RequireUserId(), ct)))
            .RequirePermission("PROSPECTS.MANAGE");
        return app;
    }
}
